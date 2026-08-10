import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom, map, tap } from 'rxjs';
import { Customer } from '../interfaces/customer';

interface CustomerApiResponse {
  success: boolean;
  customer: Customer;
  message?: string;
}

export interface CustomerProfilePatch {
  fullname: string;
  phone: string;
  address: string;
  gender: string;
  dob: string;
  avatar?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000';

  customers = signal<Customer[]>([]);

  constructor() {
    void this.refreshFromServer();
  }

  private upsertCustomer(customer: Customer): void {
    this.customers.update(current => {
      const index = current.findIndex(item => String(item.id) === String(customer.id));
      if (index === -1) return [...current, customer];

      const copy = [...current];
      copy[index] = customer;
      return copy;
    });
  }

  async refreshFromServer(): Promise<void> {
    const data = await firstValueFrom(
      this.http.get<Customer[]>(`${this.apiUrl}/customers?_t=${Date.now()}`)
    );
    this.customers.set(Array.isArray(data) ? data : []);
  }

  getCustomers(): Customer[] {
    return this.customers();
  }

  getCustomerId(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${this.apiUrl}/customers/${id}?_t=${Date.now()}`);
  }

  getLatestCustomer(id?: string, email?: string): Observable<Customer> {
    let params = new HttpParams().set('_t', Date.now().toString());
    if (id) params = params.set('id', id);
    if (email) params = params.set('email', email);

    return this.http
      .get<CustomerApiResponse>(`${this.apiUrl}/api/customers/account`, { params })
      .pipe(
        map(response => response.customer),
        tap(customer => this.upsertCustomer(customer))
      );
  }

  updateProfile(id: string, profile: CustomerProfilePatch): Observable<Customer> {
    return this.http
      .patch<CustomerApiResponse>(`${this.apiUrl}/api/customers/${id}/profile`, profile)
      .pipe(
        map(response => response.customer),
        tap(customer => this.upsertCustomer(customer))
      );
  }

  createCustomer(customer: Customer): void {
    this.http
      .post<CustomerApiResponse>(`${this.apiUrl}/api/customers/admin`, customer)
      .pipe(map(response => response.customer))
      .subscribe({
        next: createdCustomer => this.upsertCustomer(createdCustomer),
        error: error => console.error('Error creating customer:', error)
      });
  }

  addCustomer(customer: Customer): void {
    this.createCustomer(customer);
  }

  updateCustomer(customer: Customer): void {
    this.updateCustomerObservable(customer).subscribe({
      error: error => console.error('Error updating customer:', error)
    });
  }

  updateCustomerObservable(customer: Customer): Observable<Customer> {
    if (!customer.id) {
      throw new Error('Không có ID khách hàng để cập nhật.');
    }

    return this.http
      .patch<CustomerApiResponse>(`${this.apiUrl}/api/customers/${customer.id}/admin`, customer)
      .pipe(
        map(response => response.customer),
        tap(updatedCustomer => this.upsertCustomer(updatedCustomer))
      );
  }

  deleteCustomer(id: string): void {
    this.http.delete<void>(`${this.apiUrl}/customers/${id}`).subscribe({
      next: () => {
        this.customers.update(current => current.filter(customer => String(customer.id) !== String(id)));
      },
      error: error => console.error('Error deleting customer:', error)
    });
  }

  removeCustomer(id: string): void {
    this.deleteCustomer(id);
  }
}
