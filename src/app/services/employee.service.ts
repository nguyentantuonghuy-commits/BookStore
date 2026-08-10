import { Injectable, signal, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface Employee {
  id?: string;
  image: string;
  fullname: string;
  email: string;
  phone: string;
  address: string;
  gender?: string;
  dob?: string;
}

export const EMPLOYEES: Employee[] = [
  {
    id: '1',
    image: "/image/avatar.jpg",
    fullname: "Nguyễn Thành Tài",
    email: "thanhtai@gmail.com",
    phone: "0909000888",
    address: "12 ABC Q1 Tp.HCM",
  },
  {
    id: '2',
    image: "/image/avatar.jpg",
    fullname: "Nguyễn Hoàng Yến",
    email: "hoangyen@gmail.com",
    phone: "0909000888",
    address: "12 DCS Q1 Tp.HCM",
  },
  {
    id: '3',
    image: "/image/avatar.jpg",
    fullname: "Bích Thảo",
    email: "bichthao@gmail.com",
    phone: "0909000888",
    address: "15 YXZ Q1 Tp.HCM",
  },
  {
    id: '4',
    image: "/image/avatar.jpg",
    fullname: "user3",
    email: "user3@gmail.com",
    phone: "0909000888",
    address: "12 cat",
  }
];

export interface Users {
  id?: string;
  username: string;
  password: string;
  role: string;
  islocked?: boolean;
  permissions: string[];
}

export const USERS: Users[] = [
  {
    id: '1',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    islocked: false,
    permissions: ['create', 'update', 'delete']
  },
  {
    id: '2',
    username: 'user1',
    password: '123456',
    role: 'user',
    islocked: false,
    permissions: ['create', 'update']
  },
  {
    id: '3',
    username: 'user2',
    password: '123456',
    role: 'user',
    islocked: false,
    permissions: ['create', 'update']
  },
  {
    id: '4',
    username: 'user3',
    password: '123456',
    role: 'user',
    islocked: false,
    permissions: ['create', 'update']
  }
];

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private storageService = inject(StorageService);
  private http = inject(HttpClient);
  private usersKey = 'user';
  private employeesKey = 'employees';

  users = signal<Users[]>([]);
  employees = signal<Employee[]>([]);

  private usersUrl = 'http://localhost:3000/users';
  private employeesUrl = 'http://localhost:3000/employees';

  constructor() {
    this.loadData();
  }

  private loadData() {
    this.http.get<Users[]>(this.usersUrl).subscribe({
      next: (serverUsers) => {
        if (serverUsers && serverUsers.length > 0) {
          this.users.set(serverUsers);
          this.storageService.set(this.usersKey, serverUsers);
        } else {
          this.loadUsersFromLocalOrDefaults();
        }
      },
      error: (err) => {
        console.warn('Failed to load users from API, falling back to local storage.', err);
        this.loadUsersFromLocalOrDefaults();
      }
    });

    this.http.get<Employee[]>(this.employeesUrl).subscribe({
      next: (serverEmployees) => {
        if (serverEmployees && serverEmployees.length > 0) {
          this.employees.set(serverEmployees);
          this.storageService.set(this.employeesKey, serverEmployees);
        } else {
          this.loadEmployeesFromLocalOrDefaults();
        }
      },
      error: (err) => {
        console.warn('Failed to load employees from API, falling back to local storage.', err);
        this.loadEmployeesFromLocalOrDefaults();
      }
    });
  }

  private loadUsersFromLocalOrDefaults() {
    let loadedUsers = this.storageService.get<Users[]>(this.usersKey);
    if (!loadedUsers || loadedUsers.length === 0) {
      loadedUsers = [...USERS];
    }
    // Ensure the 'admin' account exists and has the correct password 'admin123'
    const adminUser = loadedUsers.find((u: any) => u.username === 'admin');
    if (!adminUser) {
      loadedUsers.push({
        id: '1',
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        islocked: false,
        permissions: ['create', 'update', 'delete']
      });
    } else if (adminUser.password !== 'admin123') {
      adminUser.password = 'admin123';
    }
    this.storageService.set(this.usersKey, loadedUsers);
    this.users.set(loadedUsers);

    // Seed json-server if possible
    loadedUsers.forEach(u => {
      this.http.post<Users>(this.usersUrl, u).subscribe({
        error: () => {}
      });
    });
  }

  private loadEmployeesFromLocalOrDefaults() {
    let loadedEmployees = this.storageService.get<Employee[]>(this.employeesKey);
    if (!loadedEmployees || loadedEmployees.length === 0) {
      loadedEmployees = [...EMPLOYEES];
    }
    this.storageService.set(this.employeesKey, loadedEmployees);
    this.employees.set(loadedEmployees);

    // Seed json-server if possible
    loadedEmployees.forEach(e => {
      this.http.post<Employee>(this.employeesUrl, e).subscribe({
        error: () => {}
      });
    });
  }

  getUsers() {
    return this.users();
  }

  getEmployees() {
    return this.employees();
  }

  addUser(user: Users) {
    this.http.post<Users>(this.usersUrl, user).subscribe({
      next: (newUser) => {
        this.users.update((u) => [...u, newUser]);
        this.storageService.set(this.usersKey, this.users());
      },
      error: (err) => {
        console.error('Failed to add user on server:', err);
      }
    });
  }

  addEmployee(employee: Employee) {
    this.http.post<Employee>(this.employeesUrl, employee).subscribe({
      next: (newEmp) => {
        this.employees.update((e) => [...e, newEmp]);
        this.storageService.set(this.employeesKey, this.employees());
      },
      error: (err) => {
        console.error('Failed to add employee on server:', err);
      }
    });
  }

  updateUser(updated: Users) {
    this.http.put<Users>(`${this.usersUrl}/${updated.id}`, updated).subscribe({
      next: (updatedUser) => {
        this.users.update((u) => u.map((x) => (x.id === updatedUser.id ? updatedUser : x)));
        this.storageService.set(this.usersKey, this.users());
      },
      error: (err) => {
        console.error('Failed to update user on server:', err);
      }
    });
  }

  updateEmployee(updated: Employee) {
    this.http.patch<Employee>(`${this.employeesUrl}/${updated.id}`, updated).subscribe({
      next: (updatedEmp) => {
        this.employees.update((e) => e.map((x) => (x.id === updatedEmp.id ? { ...x, ...updatedEmp } : x)));
        this.storageService.set(this.employeesKey, this.employees());
      },
      error: (err) => {
        console.error('Failed to update employee on server:', err);
      }
    });
  }

  updateEmployeeObservable(updated: Employee): Observable<Employee> {
    return this.http.patch<Employee>(`${this.employeesUrl}/${updated.id}`, updated).pipe(
      tap((updatedEmp) => {
        this.employees.update((e) => e.map((x) => (x.id === updatedEmp.id ? { ...x, ...updatedEmp } : x)));
        this.storageService.set(this.employeesKey, this.employees());
      })
    );
  }

  deleteUserId(id: string) {
    this.http.delete<void>(`${this.usersUrl}/${id}`).subscribe({
      next: () => {
        this.users.update((u) => u.filter((x) => x.id !== id));
        this.storageService.set(this.usersKey, this.users());
      },
      error: (err) => {
        console.error('Failed to delete user from server:', err);
      }
    });
  }

  deleteEmployeeId(id: string) {
    this.http.delete<void>(`${this.employeesUrl}/${id}`).subscribe({
      next: () => {
        this.employees.update((e) => e.filter((x) => x.id !== id));
        this.storageService.set(this.employeesKey, this.employees());
      },
      error: (err) => {
        console.error('Failed to delete employee from server:', err);
      }
    });
  }
}
