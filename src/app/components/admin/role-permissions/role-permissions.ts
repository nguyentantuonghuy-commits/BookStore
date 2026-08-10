import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PermissionService, Role, Permission } from '../../../services/permission.service';
import { EmployeeService, Users } from '../../../services/employee.service';
import { AuthService } from '../../../services/auth.service';
import { removeAccents } from '../../../utils/string-utils';

@Component({
  selector: 'app-role-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './role-permissions.html',
  styleUrl: './role-permissions.css'
})
export class RolePermissionsComponent implements OnInit {
  permissionService = inject(PermissionService);
  employeeService = inject(EmployeeService);
  authService = inject(AuthService);

  // Active view tab inside this page: 'roles' (Phân quyền vai trò) or 'users' (Gán vai trò nhân sự)
  activeSubTab = signal<'roles' | 'users'>('roles');

  // Tab 1: Role Permissions State
  selectedRoleCode = signal<string>('manager'); // default active role to display
  selectedPermissions = signal<string[]>([]); // active permission codes checked for selectedRole

  // Tab 2: User Assignment State
  userSearchQuery = signal<string>('');

  // Selected Role Object computed signal
  activeRoleObj = computed(() => {
    return this.permissionService.roles().find(r => r.code === this.selectedRoleCode());
  });

  // Group permissions by module/group
  groupedPermissions = computed(() => {
    const list = this.permissionService.permissions();
    const groups: { [key: string]: Permission[] } = {};
    list.forEach(p => {
      if (!groups[p.module]) {
        groups[p.module] = [];
      }
      groups[p.module].push(p);
    });
    return groups;
  });

  // Unique list of modules
  modules = computed(() => {
    return Object.keys(this.groupedPermissions());
  });

  // Filtered users for Tab 2
  filteredUsers = computed(() => {
    let list = this.employeeService.users();
    const query = this.userSearchQuery().toLowerCase().trim();

    if (query) {
      const cleanQuery = removeAccents(query);
      list = list.filter(u => {
        const emp = this.employeeService.employees().find(e => e.id === u.id);
        const fullname = removeAccents(emp?.fullname?.toLowerCase() || '');
        const email = removeAccents(emp?.email?.toLowerCase() || '');
        const username = removeAccents(u.username.toLowerCase());
        return fullname.includes(cleanQuery) || email.includes(cleanQuery) || username.includes(cleanQuery);
      });
    }

    return list;
  });

  ngOnInit(): void {
    if (!this.authService.hasPermission('PERMISSIONS_MANAGE')) {
      return;
    }
    this.loadActiveRolePermissions();
  }

  switchSubTab(tab: 'roles' | 'users') {
    this.activeSubTab.set(tab);
  }

  updateSearchQuery(query: string) {
    this.userSearchQuery.set(query);
  }

  // Load checked permissions for current role
  loadActiveRolePermissions() {
    const role = this.activeRoleObj();
    if (role) {
      this.selectedPermissions.set([...role.permissions]);
    } else {
      this.selectedPermissions.set([]);
    }
  }

  selectRole(roleCode: string) {
    this.selectedRoleCode.set(roleCode);
    this.loadActiveRolePermissions();
  }

  // Check if a specific permission is selected
  isPermissionChecked(code: string): boolean {
    return this.selectedPermissions().includes(code);
  }

  // Toggle single permission checkbox
  togglePermission(code: string) {
    // Super admins always have all permissions and cannot be modified
    if (this.selectedRoleCode() === 'admin') {
      alert('Không thể thay đổi quyền hạn của Quản trị viên tối cao.');
      return;
    }

    const current = this.selectedPermissions();
    if (current.includes(code)) {
      this.selectedPermissions.set(current.filter(c => c !== code));
    } else {
      this.selectedPermissions.set([...current, code]);
    }
  }

  // Check if all permissions in a module are selected
  isModuleAllChecked(moduleName: string): boolean {
    const modulePerms = this.groupedPermissions()[moduleName] || [];
    return modulePerms.every(p => this.isPermissionChecked(p.code));
  }

  // Toggle all permissions in a module
  toggleModuleAll(moduleName: string, event: any) {
    if (this.selectedRoleCode() === 'admin') {
      alert('Không thể thay đổi quyền hạn của Quản trị viên tối cao.');
      event.target.checked = true;
      return;
    }

    const checked = event.target.checked;
    const modulePerms = this.groupedPermissions()[moduleName] || [];
    const moduleCodes = modulePerms.map(p => p.code);
    const current = this.selectedPermissions();

    if (checked) {
      // Add all codes that are not already present
      const toAdd = moduleCodes.filter(c => !current.includes(c));
      this.selectedPermissions.set([...current, ...toAdd]);
    } else {
      // Remove all codes belonging to this module
      this.selectedPermissions.set(current.filter(c => !moduleCodes.includes(c)));
    }
  }

  // Save permission matrix configurations
  saveRolePermissions() {
    if (!this.authService.hasPermission('PERMISSIONS_MANAGE')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    if (this.selectedRoleCode() === 'admin') {
      alert('Không thể thay đổi quyền hạn của Quản trị viên tối cao.');
      return;
    }

    try {
      this.permissionService.assignPermissionsToRole(this.selectedRoleCode(), this.selectedPermissions());
      alert(`Đã lưu cấu hình phân quyền cho vai trò "${this.activeRoleObj()?.name}". Tất cả nhân sự thuộc vai trò này đã được đồng bộ quyền mới.`);
    } catch (err: any) {
      alert('Có lỗi xảy ra: ' + err.message);
    }
  }

  // Change user role
  handleUserRoleChange(userId: string, event: any) {
    if (!this.authService.hasPermission('PERMISSIONS_MANAGE')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      const userObj = this.employeeService.users().find(u => u.id === userId);
      if (userObj) {
        event.target.value = userObj.role;
      }
      return;
    }
    const roleCode = event.target.value;
    const userObj = this.employeeService.users().find(u => u.id === userId);
    if (!userObj) return;

    if (userObj.username === 'admin') {
      alert('Không thể thay đổi vai trò của quản trị viên tối cao.');
      event.target.value = 'admin';
      return;
    }

    if (confirm(`Bạn có chắc chắn muốn thay đổi vai trò của nhân viên "${userObj.username}" thành "${this.getRoleName(roleCode)}"? Quyền hạn của người dùng này sẽ tự động thay đổi theo vai trò mới.`)) {
      try {
        this.permissionService.assignRoleToUser(userId, roleCode);
      } catch (err: any) {
        alert(err.message || 'Lỗi khi gán vai trò.');
        // revert select element value
        event.target.value = userObj.role;
      }
    } else {
      // revert select element value
      event.target.value = userObj.role;
    }
  }

  getRoleName(code: string): string {
    const role = this.permissionService.roles().find(r => r.code === code);
    return role ? role.name : code;
  }

  getEmployeeName(userId: string): string {
    const emp = this.employeeService.employees().find(e => e.id === userId);
    return emp ? emp.fullname : 'Chưa cập nhật';
  }

  getEmployeeEmail(userId: string): string {
    const emp = this.employeeService.employees().find(e => e.id === userId);
    return emp ? emp.email : 'N/A';
  }
}
