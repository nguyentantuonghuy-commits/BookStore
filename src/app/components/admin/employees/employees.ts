import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeeService, Employee, Users } from '../../../services/employee.service';
import { AuthService } from '../../../services/auth.service';
import { removeAccents } from '../../../utils/string-utils';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employees.html',
  styleUrl: './employees.css'
})
export class EmployeesComponent implements OnInit {
  authService = inject(AuthService);
  employeeService = inject(EmployeeService);

  // Core signals
  users = signal<Users[]>([]);
  employees = signal<Employee[]>([]);

  // Search & Filter State Signals
  searchQuery = signal<string>('');
  selectedRoleFilter = signal<string>('all');
  selectedStatusFilter = signal<string>('all');

  // Modal / Form state signals
  isFormOpen = signal<boolean>(false);
  formType = signal<'add' | 'edit'>('add');

  // Shared Form Models
  userFormModel = signal<Users>({
    username: '',
    password: '',
    role: 'user',
    islocked: false,
    permissions: []
  });
  
  employeeFormModel = signal<Employee>({
    image: '/image/avatar.jpg',
    fullname: '',
    email: '',
    phone: '',
    address: ''
  });

  // Reactive Filtered List using Computed Signal
  filteredUsers = computed(() => {
    let list = this.users();
    const query = this.searchQuery().toLowerCase().trim();
    const role = this.selectedRoleFilter();
    const status = this.selectedStatusFilter();

    // 1. Search Query Filter (Matches fullname, username, email, phone, ID)
    if (query) {
      const cleanQuery = removeAccents(query);
      const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 0);
      if (queryWords.length > 0) {
        list = list.filter((u) => {
          const emp = this.getEmployee(u.id!);
          const fullname = removeAccents(emp?.fullname?.toLowerCase() || '');
          const email = removeAccents(emp?.email?.toLowerCase() || '');
          const phone = removeAccents(emp?.phone || '');
          const username = removeAccents(u.username.toLowerCase());
          const idStr = removeAccents(`emp-${u.id?.padStart(2, '0')}`);
          const fullText = `${fullname} ${email} ${phone} ${username} ${idStr}`;
          return queryWords.every(w => fullText.includes(w));
        });
      }
    }

    // 2. Role Filter
    if (role !== 'all') {
      list = list.filter((u) => u.role === role);
    }

    // 3. Status Filter
    if (status !== 'all') {
      const isLockedTarget = status === 'locked';
      list = list.filter((u) => u.islocked === isLockedTarget);
    }

    return list;
  });

  ngOnInit(): void {
    if (!this.authService.hasPermission('EMPLOYEES_VIEW')) {
      return;
    }
    this.users = this.employeeService.users;
    this.employees = this.employeeService.employees;
  }

  getEmployee(userId: string): Employee | undefined {
    return this.employees().find((emp) => emp.id === userId);
  }

  // Dashboard Stats Calculations
  getTotalEmployees(): number {
    return this.users().length;
  }

  getAdminCount(): number {
    return this.users().filter((u) => u.role === 'admin').length;
  }

  getStaffCount(): number {
    return this.users().filter((u) => u.role !== 'admin').length;
  }

  getLockedCount(): number {
    return this.users().filter((u) => u.islocked).length;
  }

  // Action Handlers
  handleAdd() {
    if (!this.authService.hasPermission('EMPLOYEES_MANAGE') && !this.authService.hasPermission('create')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    const newId = (this.users().length + 1).toString();
    this.userFormModel.set({
      id: newId,
      username: '',
      password: '123456',
      role: 'user',
      islocked: false,
      permissions: ['create', 'update'],
    });
    this.employeeFormModel.set({
      id: newId,
      image: '/image/avatar.jpg',
      fullname: '',
      email: '',
      phone: '',
      address: '',
    });
    this.formType.set('add');
    this.isFormOpen.set(true);
  }

  handleEdit(id: string) {
    if (!this.authService.hasPermission('EMPLOYEES_MANAGE') && !this.authService.hasPermission('update')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    const user = this.users().find((u) => u.id === id);
    const employee = this.employees().find((e) => e.id === id);

    if (user && employee) {
      // Create deep copies to avoid modifying list immediately
      this.userFormModel.set({ ...user, permissions: [...user.permissions] });
      this.employeeFormModel.set({ ...employee });
      this.formType.set('edit');
      this.isFormOpen.set(true);
    }
  }

  handleCancel() {
    this.isFormOpen.set(false);
  }

  handleSave() {
    const u = this.userFormModel();
    const emp = this.employeeFormModel();
    
    if (!u.username.trim() || !emp.fullname.trim() || !emp.email.trim() || !emp.phone.trim()) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    if (this.formType() === 'add') {
      if (!this.authService.hasPermission('EMPLOYEES_MANAGE') && !this.authService.hasPermission('create')) {
        alert('Bạn không có quyền thêm nhân viên mới.');
        return;
      }
    } else {
      if (!this.authService.hasPermission('EMPLOYEES_MANAGE') && !this.authService.hasPermission('update')) {
        alert('Bạn không có quyền cập nhật thông tin nhân viên.');
        return;
      }
    }

    // Auto assign permissions based on role
    u.permissions = u.role === 'admin' ? ['create', 'update', 'delete'] : ['create', 'update'];

    if (this.formType() === 'add') {
      this.employeeService.addUser(u);
      this.employeeService.addEmployee(emp);
    } else {
      this.employeeService.updateUser(u);
      this.employeeService.updateEmployee(emp);
    }
    
    this.handleCancel();
  }

  handleDelete(id: string) {
    if (!this.authService.hasPermission('EMPLOYEES_MANAGE') && !this.authService.hasPermission('delete')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    if (id === '1') {
      alert('Không thể xóa tài khoản quản trị viên tối cao.');
      return;
    }
    if (confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
      this.employeeService.deleteUserId(id);
      this.employeeService.deleteEmployeeId(id);
    }
  }

  toggleLock(user: Users) {
    if (!this.authService.hasPermission('EMPLOYEES_MANAGE') && !this.authService.hasPermission('update')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    if (user.username === 'admin') {
      alert('Không thể khóa tài khoản quản trị viên tối cao.');
      return;
    }
    const updatedUser = { ...user, islocked: !user.islocked };
    this.employeeService.updateUser(updatedUser);
  }

  handleImageChange(event: any, id?: string) {
    if (!this.authService.hasPermission('EMPLOYEES_MANAGE') && !this.authService.hasPermission('update')) {
      alert('Bạn không có quyền tải lên hình ảnh.');
      return;
    }
    const file = event.target.files[0];
    if (!file) return;
    const imagePath = '/image/' + file.name;

    if (id) {
      const employee = this.employees().find((e) => e.id === id);
      if (employee) {
        const updated = { ...employee, image: imagePath };
        this.employeeService.updateEmployee(updated);
      }
    } else {
      this.employeeFormModel.update((emp) => ({ ...emp, image: imagePath }));
    }
  }

  // CSV Excel Export Logic
  exportToExcel() {
    if (!this.authService.hasPermission('EMPLOYEES_EXPORT', 'Nhân viên')) {
      alert('Bạn không có quyền xuất dữ liệu Excel.');
      return;
    }
    const headers = ["ID", "Tên đăng nhập", "Họ và Tên", "Email", "Số điện thoại", "Vai trò", "Trạng thái"];
    
    const rows = this.filteredUsers().map((user) => {
      const emp = this.getEmployee(user.id!);
      const id = `EMP-${user.id?.padStart(2, '0')}`;
      const role = user.role === 'admin' ? 'Quản trị viên' : 'Nhân viên';
      const status = user.islocked ? 'Bị khóa' : 'Hoạt động';
      
      // Escape double quotes and wrap fields with potential commas/newlines in quotes
      const fullname = (emp?.fullname || '').replace(/"/g, '""');
      const email = emp?.email || '';
      const phone = emp?.phone || '';
      
      return [
        id,
        user.username,
        `"${fullname}"`,
        email,
        phone,
        role,
        status
      ].join(',');
    });

    const csvData = [headers.join(','), ...rows].join('\n');
    
    // Create UTF-8 BOM (\uFEFF) to make Excel parse Vietnamese characters and columns correctly
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvData], {
      type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "danh_sach_nhan_su.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
