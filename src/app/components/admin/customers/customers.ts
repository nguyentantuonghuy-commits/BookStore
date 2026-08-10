import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Customer } from '../../../interfaces/customer';
import { CustomerService } from '../../../services/customer.service';
import { AuthService } from '../../../services/auth.service';
import { removeAccents } from '../../../utils/string-utils';

const EMPTY_CUSTOMER: Customer = {
  id: '',
  username: '',
  password: '',
  fullname: '',
  phone: '',
  email: '',
  address: '',
  role: 'customer',
  islocked: false,
  isGoogleAccount: false,
};

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customers.html',
  styleUrl: './customers.css'
})
export class CustomersComponent implements OnInit {
  customerService = inject(CustomerService);
  authService = inject(AuthService);

  // Core data source signal
  customers = this.customerService.customers;

  ngOnInit() {
    if (!this.authService.hasPermission('CUSTOMERS_VIEW')) {
      return;
    }
    this.customerService.refreshFromServer();
  }

  // Search & Filter state
  searchQuery = signal<string>('');
  selectedStatusFilter = signal<string>('all');
  selectedAccountTypeFilter = signal<string>('all');

  // Modal form state
  isFormOpen = signal<boolean>(false);
  formType = signal<'add' | 'edit'>('add');
  customerFormModel = signal<Customer>({ ...EMPTY_CUSTOMER });

  // View Modal state
  isViewOpen = signal<boolean>(false);
  viewingCustomer = signal<Customer | null>(null);

  // Password show/hide state maps
  showPasswords = signal<{ [key: string]: boolean }>({});
  showFormPassword = signal<boolean>(false);

  // Computed signal for instant searching & status filtering
  filteredCustomers = computed(() => {
    let list = this.customers();
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.selectedStatusFilter();
    const accountType = this.selectedAccountTypeFilter();

    if (query) {
      const cleanQuery = removeAccents(query);
      const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 0);
      if (queryWords.length > 0) {
        list = list.filter(c => {
          const fullname = removeAccents(c.fullname?.toLowerCase() || '');
          const username = removeAccents(c.username?.toLowerCase() || '');
          const email = removeAccents(c.email?.toLowerCase() || '');
          const phone = removeAccents(c.phone?.toLowerCase() || '');
          const id = removeAccents(c.id?.toLowerCase() || '');
          const fullText = `${fullname} ${username} ${email} ${phone} ${id}`;
          return queryWords.every(w => fullText.includes(w));
        });
      }
    }

    if (status !== 'all') {
      const lockTarget = status === 'locked';
      list = list.filter(c => c.islocked === lockTarget);
    }

    if (accountType !== 'all') {
      const isGoogle = accountType === 'google';
      list = list.filter(c => !!c.isGoogleAccount === isGoogle);
    }

    return list;
  });

  // Top stats helpers
  getTotalCustomers(): number {
    return this.customers().length;
  }

  getActiveCustomers(): number {
    return this.customers().filter(c => !c.islocked).length;
  }

  getLockedCustomers(): number {
    return this.customers().filter(c => c.islocked).length;
  }

  // Action Handlers
  handleAdd(): void {
    if (!this.authService.hasPermission('CUSTOMERS_EDIT') && !this.authService.hasPermission('create')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    this.formType.set('add');
    this.customerFormModel.set({ ...EMPTY_CUSTOMER });
    this.showFormPassword.set(false);
    this.isFormOpen.set(true);
  }

  handleEdit(customer: Customer): void {
    if (!this.authService.hasPermission('CUSTOMERS_EDIT') && !this.authService.hasPermission('update')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    this.formType.set('edit');
    // Deep copy to prevent mutating list directly before saving
    this.customerFormModel.set({ ...customer });
    this.showFormPassword.set(false);
    this.isFormOpen.set(true);
  }

  handleCancel(): void {
    this.isFormOpen.set(false);
  }

  handleSave(): void {
    const model = this.customerFormModel();
    if (!model.username.trim() || (!model.isGoogleAccount && !model.password.trim()) || !model.fullname.trim() || !model.email.trim()) {
      alert('Vui lòng điền đầy đủ các trường thông tin bắt buộc (*)');
      return;
    }

    if (this.formType() === 'add') {
      if (!this.authService.hasPermission('CUSTOMERS_EDIT') && !this.authService.hasPermission('create')) {
        alert('Bạn không có quyền thêm khách hàng mới.');
        return;
      }
    } else {
      if (!this.authService.hasPermission('CUSTOMERS_EDIT') && !this.authService.hasPermission('update')) {
        alert('Bạn không có quyền cập nhật thông tin khách hàng.');
        return;
      }
    }

    const current = this.customers();

    if (this.formType() === 'add') {
      if (current.some(c => c.username.toLowerCase() === model.username.trim().toLowerCase())) {
        alert('Tên đăng nhập đã tồn tại!');
        return;
      }
      if (current.some(c => c.email.toLowerCase() === model.email.trim().toLowerCase())) {
        alert('Email đã tồn tại!');
        return;
      }

      // Generate ID
      let maxNum = 0;
      current.forEach(c => {
        if (c.id && c.id.startsWith('cus')) {
          const num = parseInt(c.id.substring(3));
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });
      const newId = 'cus' + (maxNum + 1);

      const newCus: Customer = {
        ...model,
        id: newId,
        username: model.username.trim(),
        email: model.email.trim(),
        fullname: model.fullname.trim()
      };

      this.customerService.addCustomer(newCus);
    } else {
      // Edit mode checks
      if (current.some(c => c.id !== model.id && c.username.toLowerCase() === model.username.trim().toLowerCase())) {
        alert('Tên đăng nhập đã tồn tại ở tài khoản khác!');
        return;
      }
      if (current.some(c => c.id !== model.id && c.email.toLowerCase() === model.email.trim().toLowerCase())) {
        alert('Email đã tồn tại ở tài khoản khác!');
        return;
      }

      const updatedCus: Customer = {
        ...model,
        username: model.username.trim(),
        email: model.email.trim(),
        fullname: model.fullname.trim()
      };

      this.customerService.updateCustomer(updatedCus);
    }

    this.isFormOpen.set(false);
  }

  handleDelete(id: string): void {
    if (!this.authService.hasPermission('CUSTOMERS_EDIT') && !this.authService.hasPermission('delete')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    if (confirm('Bạn có chắc chắn muốn xóa khách hàng này?')) {
      this.customerService.removeCustomer(id);
    }
  }

  toggleLock(customer: Customer): void {
    if (!this.authService.hasPermission('CUSTOMERS_LOCK') && !this.authService.hasPermission('update')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    const updated = { ...customer, islocked: !customer.islocked };
    this.customerService.updateCustomer(updated);
  }

  togglePasswordVisibility(id: string): void {
    this.showPasswords.update(map => ({
      ...map,
      [id]: !map[id]
    }));
  }

  toggleFormPasswordVisibility(): void {
    this.showFormPassword.update(v => !v);
  }

  getCustomerInitials(fullname: string): string {
    if (!fullname) return 'C';
    const parts = fullname.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullname.substring(0, Math.min(2, fullname.length)).toUpperCase();
  }

  handleView(customer: Customer): void {
    if (!this.authService.hasPermission('CUSTOMERS_VIEW')) {
      alert('Bạn không có quyền xem thông tin chi tiết khách hàng.');
      return;
    }
    // 1. Refresh list from server to ensure local data is updated
    this.customerService.refreshFromServer().then(() => {
      // 2. Query specific customer details directly from server for double safety
      this.customerService.getCustomerId(customer.id!).subscribe({
        next: (latestCus) => {
          this.viewingCustomer.set(latestCus);
          this.isViewOpen.set(true);
        },
        error: (err) => {
          console.error('Lỗi khi lấy chi tiết khách hàng:', err);
          // Fallback to local list if direct fetch fails
          const found = this.customers().find(c => c.id === customer.id);
          this.viewingCustomer.set(found ? { ...found } : { ...customer });
          this.isViewOpen.set(true);
        }
      });
    }).catch(() => {
      // Fallback in case list refresh fails
      this.customerService.getCustomerId(customer.id!).subscribe({
        next: (latestCus) => {
          this.viewingCustomer.set(latestCus);
          this.isViewOpen.set(true);
        },
        error: () => {
          this.viewingCustomer.set({ ...customer });
          this.isViewOpen.set(true);
        }
      });
    });
  }

  closeView(): void {
    this.isViewOpen.set(false);
  }
}
