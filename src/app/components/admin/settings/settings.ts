import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../../services/storage.service';

interface GeneralSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  openingHours: string;
}

interface ShippingTaxSettings {
  vatPercent: number;
  shipInnerCity: number;
  shipOuterCity: number;
  freeShipThreshold: number;
}

interface PaymentSettings {
  bankName: string;
  accountName: string;
  accountNumber: string;
  momoEnabled: boolean;
  vnPayEnabled: boolean;
  codEnabled: boolean;
}

interface SecuritySettings {
  passwordExpiryDays: number;
  sessionTimeoutMinutes: number;
  maintenanceMode: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class SettingsComponent implements OnInit {
  private storageService = inject(StorageService);

  // Tabs: 'general' | 'shipping' | 'payment' | 'security'
  activeSubTab = signal<'general' | 'shipping' | 'payment' | 'security'>('general');

  // Loading States
  isSaving = signal<boolean>(false);
  isBackingUp = signal<boolean>(false);
  isRestoring = signal<boolean>(false);

  // Form Models
  general = signal<GeneralSettings>({
    storeName: 'Sachweb Luxury Bookstore',
    storeAddress: '273 An Dương Vương, Phường 3, Quận 5, TP. Hồ Chí Minh',
    storePhone: '0901234567',
    storeEmail: 'contact@sachweb.vn',
    openingHours: '08:00 - 22:00 (Hàng ngày)'
  });

  shipping = signal<ShippingTaxSettings>({
    vatPercent: 8,
    shipInnerCity: 25000,
    shipOuterCity: 40000,
    freeShipThreshold: 500000
  });

  payment = signal<PaymentSettings>({
    bankName: 'Vietcombank (VCB)',
    accountName: 'CONG TY TNHH SACHWEB VIETNAM',
    accountNumber: '1028889999',
    momoEnabled: true,
    vnPayEnabled: true,
    codEnabled: true
  });

  security = signal<SecuritySettings>({
    passwordExpiryDays: 90,
    sessionTimeoutMinutes: 30,
    maintenanceMode: false
  });

  // Notification State
  notification = signal<{ message: string; type: 'success' | 'danger' | 'info' | null }>({
    message: '',
    type: null
  });

  ngOnInit() {
    this.loadSettings();
  }

  changeTab(tab: 'general' | 'shipping' | 'payment' | 'security') {
    this.activeSubTab.set(tab);
  }

  loadSettings() {
    try {
      const savedGeneral = this.storageService.get<GeneralSettings>('settings_general');
      const savedShipping = this.storageService.get<ShippingTaxSettings>('settings_shipping');
      const savedPayment = this.storageService.get<PaymentSettings>('settings_payment');
      const savedSecurity = this.storageService.get<SecuritySettings>('settings_security');

      if (savedGeneral) this.general.set(savedGeneral);
      if (savedShipping) this.shipping.set(savedShipping);
      if (savedPayment) this.payment.set(savedPayment);
      if (savedSecurity) this.security.set(savedSecurity);
    } catch (e) {
      this.showToast('Không thể tải cấu hình lưu trữ!', 'danger');
    }
  }

  saveSettings() {
    this.isSaving.set(true);

    // Simulate API Call delay
    setTimeout(() => {
      try {
        this.storageService.set('settings_general', this.general());
        this.storageService.set('settings_shipping', this.shipping());
        this.storageService.set('settings_payment', this.payment());
        this.storageService.set('settings_security', this.security());

        this.showToast('Cập nhật cấu hình hệ thống thành công!', 'success');
      } catch (e) {
        this.showToast('Lỗi lưu trữ cấu hình!', 'danger');
      } finally {
        this.isSaving.set(false);
      }
    }, 1000);
  }

  showToast(message: string, type: 'success' | 'danger' | 'info') {
    this.notification.set({ message, type });
    setTimeout(() => {
      this.notification.set({ message: '', type: null });
    }, 4000);
  }

  // Simulated Database Actions
  triggerBackup() {
    if (this.isBackingUp()) return;
    this.isBackingUp.set(true);

    setTimeout(() => {
      this.isBackingUp.set(false);
      this.showToast('Sao lưu cơ sở dữ liệu hệ thống thành công! File: backup_' + new Date().toISOString().slice(0, 10) + '.sql', 'success');
    }, 2000);
  }

  triggerRestore() {
    if (this.isRestoring()) return;
    this.isRestoring.set(true);

    setTimeout(() => {
      this.isRestoring.set(false);
      this.showToast('Khôi phục cơ sở dữ liệu hoàn tất. Hệ thống đã đồng bộ hóa!', 'success');
    }, 2500);
  }
}
