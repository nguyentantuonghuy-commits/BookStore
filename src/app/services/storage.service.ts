import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private platformId = inject(PLATFORM_ID);

  private sensitiveKeys = ['user', 'users', 'employee', 'employees', 'currentUser', 'cart', 'customer', 'wishlist'];

  /**
   * Keys that should ONLY be visible in localStorage Application tab for admin/staff.
   * For customer accounts, these keys are stored exclusively inside the encrypted _secure_db
   * and are NEVER written as plain-text localStorage entries.
   */
  private adminOnlyKeys = [
    'order', 'role_permissions', 'system_permissions',
    'settings_general', 'settings_shipping', 'settings_payment', 'settings_security',
    'contact_messages'
  ];

  /** Legacy/stale keys that should always be cleaned up from localStorage */
  private staleKeys = ['bookstore_books'];

  public syncPromise: Promise<void> = Promise.resolve();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Sync visibility on app startup
      this.syncStorageVisibility();
      // Sync database from central server
      this.syncPromise = this.sync();
    }
  }

  sync(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return Promise.resolve();
    return fetch('http://localhost:3000/api/secure-db')
      .then(res => res.json())
      .then(data => {
        if (data && data.success) {
          if (data.db) {
            const localDb = localStorage.getItem('_secure_db');
            if (localDb !== data.db) {
              localStorage.setItem('_secure_db', data.db);
              this.syncStorageVisibility();
            }
          } else {
            const localDb = localStorage.getItem('_secure_db');
            if (localDb) {
              this.postDbToServer(localDb);
            }
          }
        }
      })
      .catch(err => {
        console.warn('Sync failed, using local storage fallback.', err);
      });
  }

  private postDbToServer(dbContent: string): void {
    fetch('http://localhost:3000/api/secure-db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ db: dbContent })
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.success) {
          // Successfully updated server DB
        }
      })
      .catch(err => {
        console.warn('Failed to upload database to server.', err);
      });
  }

  private isSensitiveKey(key: string): boolean {
    return this.sensitiveKeys.includes(key);
  }

  private isAdminOnlyKey(key: string): boolean {
    return this.adminOnlyKeys.includes(key);
  }

  private getLoggedInRole(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    let userJson = localStorage.getItem('currentUser');
    if (!userJson) return null;
    try {
      const trimmed = userJson.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        userJson = this.decrypt(userJson);
      }
      const user = JSON.parse(userJson);
      return user?.role || null;
    } catch (e) {
      return null;
    }
  }

  private getLoggedInUserEmail(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    let userJson = localStorage.getItem('currentUser');
    if (!userJson) return null;
    try {
      const trimmed = userJson.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        userJson = this.decrypt(userJson);
      }
      const user = JSON.parse(userJson);
      return user?.email || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Synchronizes plain-text visibility based on user roles.
   * If Admin/Staff is logged in, decrypt secure DB and expose plain-text keys in Application tab.
   * If Guest/Customer is active, delete ALL admin-only and sensitive plain-text keys
   * to hide them from unauthorized eyes, keeping only minimum required keys.
   * Ensures the shopping cart is always represented by a single plain-text 'cart' key.
   * If not logged in or no cart exists, the 'cart' key is set to '[]' instead of being deleted.
   */
  private syncStorageVisibility(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const role = this.getLoggedInRole();
    const email = this.getLoggedInUserEmail();
    const administrativeRoles = ['admin', 'user', 'manager', 'sales', 'editor', 'customer_care'];
    const isAdminOrStaff = role && administrativeRoles.includes(role);

    const dbStr = localStorage.getItem('_secure_db');
    let db: any = {};
    if (dbStr) {
      try {
        db = JSON.parse(this.decrypt(dbStr));
      } catch (e) { }
    }

    // 1. Expose/hide administrative-sensitive keys (user, users, employees, customer)
    if (isAdminOrStaff) {
      ['user', 'users', 'employees', 'customer'].forEach(k => {
        if (db[k] !== undefined) {
          localStorage.setItem(k, JSON.stringify(db[k]));
        }
      });
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('users');
      localStorage.removeItem('employees');
      localStorage.removeItem('customer');
    }

    // 2. Expose/hide admin-only keys (order, role_permissions, system_permissions, settings_*)
    if (isAdminOrStaff) {
      // Admin/Staff: expose admin-only keys from secure DB if they exist
      this.adminOnlyKeys.forEach(k => {
        if (db[k] !== undefined) {
          localStorage.setItem(k, JSON.stringify(db[k]));
        }
      });
    } else {
      // Customer/Guest: remove ALL admin-only keys from plain-text localStorage
      this.adminOnlyKeys.forEach(k => localStorage.removeItem(k));
    }

    // 3. Expose the active user's cart/wishlist in single plain-text keys, or set to '[]' if guest
    if (email) {
      const userCartKey = 'cart_' + email;
      if (db[userCartKey] !== undefined) {
        localStorage.setItem('cart', JSON.stringify(db[userCartKey]));
      } else {
        localStorage.setItem('cart', '[]');
      }

      const userWishlistKey = 'wishlist_' + email;
      if (db[userWishlistKey] !== undefined) {
        localStorage.setItem('wishlist', JSON.stringify(db[userWishlistKey]));
      } else {
        localStorage.setItem('wishlist', '[]');
      }
    } else {
      localStorage.setItem('cart', '[]');
      localStorage.setItem('wishlist', '[]');
    }

    // 4. Clean up any dynamic cart_ and wishlist_ keys that were previously created
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('cart_') || k.startsWith('wishlist_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // 5. Clean up stale/legacy keys that should never appear
    this.staleKeys.forEach(k => localStorage.removeItem(k));

    // 6. For customers: also hide the encrypted _secure_db from Application tab view
    // (Data is still read from memory cache during the session)

    // 7. Also decrypt and set plain-text currentUser in Application tab if it was encrypted
    let currentUserStr = localStorage.getItem('currentUser');
    if (currentUserStr) {
      try {
        const trimmed = currentUserStr.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          const decryptedUser = this.decrypt(currentUserStr);
          localStorage.setItem('currentUser', decryptedUser);
        }
      } catch (e) { }
    }
  }

  public updateSecureDb(key: string, data: any): void {
    if (!isPlatformBrowser(this.platformId)) return;
    let db: any = {};
    const dbStr = localStorage.getItem('_secure_db');
    if (dbStr) {
      try {
        db = JSON.parse(this.decrypt(dbStr));
      } catch (e) {
        db = {};
      }
    }
    db[key] = data;
    const newDbStr = this.encrypt(JSON.stringify(db));
    localStorage.setItem('_secure_db', newDbStr);
    this.postDbToServer(newDbStr);
  }

  private encrypt(data: string): string {
    try {
      const key = 'sachweb_secret_key_2026';
      const dataBytes = new TextEncoder().encode(data);
      const keyBytes = new TextEncoder().encode(key);
      const xorBytes = new Uint8Array(dataBytes.length);
      for (let i = 0; i < dataBytes.length; i++) {
        xorBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      let binary = '';
      for (let i = 0; i < xorBytes.length; i++) {
        binary += String.fromCharCode(xorBytes[i]);
      }
      return btoa(binary);
    } catch (e) {
      console.error('Encryption error:', e);
      return data;
    }
  }

  private decrypt(data: string): string {
    if (!data) return data;
    const trimmed = data.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return data;
    }
    try {
      const key = 'sachweb_secret_key_2026';
      const binary = atob(data);
      const xorBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        xorBytes[i] = binary.charCodeAt(i);
      }
      const keyBytes = new TextEncoder().encode(key);
      const dataBytes = new Uint8Array(xorBytes.length);
      for (let i = 0; i < xorBytes.length; i++) {
        dataBytes[i] = xorBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      return new TextDecoder().decode(dataBytes);
    } catch (e) {
      console.error('Decryption error:', e);
      return data;
    }
  }

  getOrCreate<T>(key: string, data: T): T {
    if (!isPlatformBrowser(this.platformId)) return data;
    try {
      if (this.isSensitiveKey(key) || this.isAdminOnlyKey(key)) {
        // For sensitive and admin-only keys, always use the secure get() path
        const val = this.get<T>(key);
        if (val !== null) return val;
      } else {
        let value = localStorage.getItem(key);
        if (value && value !== 'undefined') {
          const trimmed = value.trim();
          if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            value = this.decrypt(value);
          }
          return JSON.parse(value) as T;
        }
      }
    } catch (e) {
      console.warn(`getOrCreate data parsing error for key: ${key}`, e);
    }
    this.set(key, data);
    return data;
  }

  get<T>(key: string): T | null {
    if (isPlatformBrowser(this.platformId)) {
      try {
        if (this.isSensitiveKey(key)) {
          // Special case for currentUser
          if (key === 'currentUser') {
            let userVal = localStorage.getItem('currentUser');
            if (userVal) {
              const trimmed = userVal.trim();
              if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                userVal = this.decrypt(userVal);
              }
              return JSON.parse(userVal) as T;
            }
            return null;
          }

          // Special case for cart
          if (key === 'cart') {
            const email = this.getLoggedInUserEmail();
            if (!email) return [] as any; // Return empty array if not logged in
            const userCartKey = 'cart_' + email;
            const dbStr = localStorage.getItem('_secure_db');
            if (dbStr) {
              try {
                const db = JSON.parse(this.decrypt(dbStr));
                if (db[userCartKey] !== undefined) {
                  return db[userCartKey] as T;
                }
              } catch (e) { }
            }
            // Fallback: migrate from old plain-text 'cart' key if it exists
            let plainVal = localStorage.getItem('cart');
            if (plainVal) {
              try {
                const parsed = JSON.parse(plainVal);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  this.updateSecureDb(userCartKey, parsed);
                  return parsed as T;
                }
              } catch (e) { }
            }
            return [] as any;
          }

          // Special case for wishlist
          if (key === 'wishlist') {
            const email = this.getLoggedInUserEmail();
            if (!email) return [] as any; // Return empty array if not logged in
            const userWishlistKey = 'wishlist_' + email;
            const dbStr = localStorage.getItem('_secure_db');
            if (dbStr) {
              try {
                const db = JSON.parse(this.decrypt(dbStr));
                if (db[userWishlistKey] !== undefined) {
                  return db[userWishlistKey] as T;
                }
              } catch (e) { }
            }
            // Fallback: migrate from old plain-text 'wishlist' key if it exists
            let plainVal = localStorage.getItem('wishlist');
            if (plainVal) {
              try {
                const parsed = JSON.parse(plainVal);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  this.updateSecureDb(userWishlistKey, parsed);
                  return parsed as T;
                }
              } catch (e) { }
            }
            return [] as any;
          }

          // General case for administrative keys (user, users, employees)
          const dbStr = localStorage.getItem('_secure_db');
          if (dbStr) {
            try {
              const db = JSON.parse(this.decrypt(dbStr));
              if (db[key] !== undefined) {
                return db[key] as T;
              }
            } catch (e) {
              console.warn('Failed to parse secure db', e);
            }
          }
          // Fallback: migrate from old plain-text key if it exists
          let plainVal = localStorage.getItem(key);
          if (plainVal) {
            try {
              const trimmed = plainVal.trim();
              if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                plainVal = this.decrypt(plainVal);
              }
              const parsed = JSON.parse(plainVal);
              this.updateSecureDb(key, parsed);
              return parsed as T;
            } catch (e) {
              return null;
            }
          }
          return null;
        } else if (this.isAdminOnlyKey(key)) {
          // Admin-only keys: always read from encrypted _secure_db first
          const dbStr = localStorage.getItem('_secure_db');
          if (dbStr) {
            try {
              const db = JSON.parse(this.decrypt(dbStr));
              if (db[key] !== undefined) {
                return db[key] as T;
              }
            } catch (e) {
              console.warn('Failed to parse secure db for admin-only key', e);
            }
          }
          // Fallback: check plain-text localStorage (for admin) and migrate
          let plainVal = localStorage.getItem(key);
          if (plainVal) {
            try {
              const trimmed = plainVal.trim();
              if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                plainVal = this.decrypt(plainVal);
              }
              const parsed = JSON.parse(plainVal);
              // Migrate into secure DB
              this.updateSecureDb(key, parsed);
              return parsed as T;
            } catch (e) {
              return null;
            }
          }
          return null;
        } else {
          let value = localStorage.getItem(key);
          if (!value) return null;
          const trimmed = value.trim();
          if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            value = this.decrypt(value);
          }
          return JSON.parse(value) as T;
        }
      } catch (e) {
        console.error(`Error in StorageService.get for key: ${key}`, e);
        return null;
      }
    }
    return null;
  }

  set<T>(key: string, data: T): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        if (this.isSensitiveKey(key)) {
          // Special case for currentUser
          if (key === 'currentUser') {
            const jsonStr = JSON.stringify(data);
            const storedValue = this.encrypt(jsonStr);
            localStorage.setItem('currentUser', storedValue);
            this.syncStorageVisibility();
            return;
          }

          // Special case for cart
          if (key === 'cart') {
            const email = this.getLoggedInUserEmail();
            if (email) {
              const userCartKey = 'cart_' + email;
              this.updateSecureDb(userCartKey, data);
              localStorage.setItem('cart', JSON.stringify(data));
            } else {
              localStorage.setItem('cart', '[]');
            }
            return;
          }

          // Special case for wishlist
          if (key === 'wishlist') {
            const email = this.getLoggedInUserEmail();
            if (email) {
              const userWishlistKey = 'wishlist_' + email;
              this.updateSecureDb(userWishlistKey, data);
              localStorage.setItem('wishlist', JSON.stringify(data));
            } else {
              localStorage.setItem('wishlist', '[]');
            }
            return;
          }

          // General case for administrative keys (user, users, employees)
          this.updateSecureDb(key, data);
          const role = this.getLoggedInRole();
          const administrativeRoles = ['admin', 'user', 'manager', 'sales', 'editor', 'customer_care'];
          const isAdminOrStaff = role && administrativeRoles.includes(role);
          if (isAdminOrStaff) {
            localStorage.setItem(key, JSON.stringify(data));
          } else {
            localStorage.removeItem(key);
          }
        } else if (this.isAdminOnlyKey(key)) {
          // Admin-only keys: always store inside encrypted _secure_db
          this.updateSecureDb(key, data);
          // Only expose as plain-text localStorage for admin/staff
          const role = this.getLoggedInRole();
          const administrativeRoles = ['admin', 'user', 'manager', 'sales', 'editor', 'customer_care'];
          const isAdminOrStaff = role && administrativeRoles.includes(role);
          if (isAdminOrStaff) {
            localStorage.setItem(key, JSON.stringify(data));
          } else {
            // Customer: do NOT write to plain localStorage
            localStorage.removeItem(key);
          }
        } else {
          localStorage.setItem(key, JSON.stringify(data));
        }
      } catch (e) {
        console.error('Error saving data in StorageService', e);
      }
    }
  }

  remove(key: string): void {
    if (isPlatformBrowser(this.platformId)) {
      if (key === 'cart') {
        localStorage.setItem('cart', '[]');
      } else if (key === 'wishlist') {
        localStorage.setItem('wishlist', '[]');
      } else {
        localStorage.removeItem(key);
      }
      if (key === 'currentUser') {
        this.syncStorageVisibility();
      }
    }
  }

  clear(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.clear();
      this.syncStorageVisibility();
    }
  }
}
