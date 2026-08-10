import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PermissionService, Permission } from '../../../services/permission.service';
import { AuthService } from '../../../services/auth.service';
import { removeAccents } from '../../../utils/string-utils';

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './permissions.html',
  styleUrl: './permissions.css'
})
export class PermissionsComponent implements OnInit {
  permissionService = inject(PermissionService);
  authService = inject(AuthService);

  // Search & Filter State
  searchQuery = signal<string>('');
  selectedModuleFilter = signal<string>('all');

  // Modal / Form state signals
  isFormOpen = signal<boolean>(false);
  formType = signal<'add' | 'edit'>('add');

  // Form Model
  formModel = signal<Permission>({
    id: '',
    code: '',
    name: '',
    module: 'Sản phẩm',
    description: ''
  });

  // Unique list of modules for filtering
  modulesList = computed(() => {
    const perms = this.permissionService.permissions();
    const modules = perms.map(p => p.module);
    return Array.from(new Set(modules));
  });

  // Reactive filtered list using Computed Signal
  filteredPermissions = computed(() => {
    let list = this.permissionService.permissions();
    const query = this.searchQuery().toLowerCase().trim();
    const moduleFilter = this.selectedModuleFilter();

    if (query) {
      const cleanQuery = removeAccents(query);
      list = list.filter(p =>
        removeAccents(p.code).toLowerCase().includes(cleanQuery) ||
        removeAccents(p.name).toLowerCase().includes(cleanQuery) ||
        removeAccents(p.description).toLowerCase().includes(cleanQuery)
      );
    }

    if (moduleFilter !== 'all') {
      list = list.filter(p => p.module === moduleFilter);
    }

    return list;
  });

  ngOnInit(): void {
    if (!this.authService.hasPermission('PERMISSIONS_MANAGE')) {
      return;
    }
    // Initial load
  }

  isSystemPermission(code: string): boolean {
    const systemCodes = [
      'DASHBOARD_VIEW', 'PRODUCTS_VIEW', 'PRODUCTS_CREATE', 'PRODUCTS_EDIT',
      'PRODUCTS_DELETE', 'ORDERS_VIEW', 'ORDERS_STATUS', 'EMPLOYEES_VIEW',
      'EMPLOYEES_MANAGE', 'CUSTOMERS_VIEW', 'CUSTOMERS_LOCK', 'PERMISSIONS_MANAGE',
      'PROMOTIONS_VIEW', 'PROMOTIONS_CREATE', 'PROMOTIONS_EDIT', 'PROMOTIONS_DELETE'
    ];
    return systemCodes.includes(code);
  }

  handleAdd() {
    if (!this.authService.hasPermission('PERMISSIONS_MANAGE')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    this.formModel.set({
      id: 'perm_' + Date.now(),
      code: '',
      name: '',
      module: 'Sản phẩm',
      description: ''
    });
    this.formType.set('add');
    this.isFormOpen.set(true);
  }

  handleEdit(permission: Permission) {
    if (!this.authService.hasPermission('PERMISSIONS_MANAGE')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    this.formModel.set({ ...permission });
    this.formType.set('edit');
    this.isFormOpen.set(true);
  }

  handleCancel() {
    this.isFormOpen.set(false);
  }

  handleSave() {
    if (!this.authService.hasPermission('PERMISSIONS_MANAGE')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    const model = this.formModel();

    if (!model.code.trim() || !model.name.trim() || !model.module.trim()) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    // Format code: UPPERCASE, underscores
    model.code = model.code.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

    // Validate code uniqueness for new permissions
    if (this.formType() === 'add') {
      const exists = this.permissionService.permissions().some(p => p.code === model.code);
      if (exists) {
        alert('Mã quyền hạn này đã tồn tại trong hệ thống.');
        return;
      }
      this.permissionService.addPermission(model);
    } else {
      this.permissionService.updatePermission(model);
    }

    this.handleCancel();
  }

  handleDelete(permission: Permission) {
    if (!this.authService.hasPermission('PERMISSIONS_MANAGE')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    if (this.isSystemPermission(permission.code)) {
      alert('Không thể xóa quyền hệ thống mặc định.');
      return;
    }

    if (confirm(`Bạn có chắc chắn muốn xóa quyền hạn "${permission.name}" (${permission.code})? Hành động này sẽ thu hồi quyền này từ các vai trò liên quan.`)) {
      try {
        this.permissionService.deletePermission(permission.id);
      } catch (err: any) {
        alert(err.message || 'Có lỗi xảy ra khi xóa quyền.');
      }
    }
  }
}
