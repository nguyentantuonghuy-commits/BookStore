import { Injectable, signal, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { EmployeeService } from './employee.service';

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  permissions: string[]; // List of permission codes
}

export const DEFAULT_PERMISSIONS: Permission[] = [
  { id: 'p1', code: 'DASHBOARD_VIEW', name: 'Xem báo cáo thống kê', module: 'Hệ thống', description: 'Cho phép truy cập trang tổng quan dashboard, xem doanh thu và tăng trưởng.' },
  { id: 'p2', code: 'PRODUCTS_VIEW', name: 'Xem danh sách sách', module: 'Sách', description: 'Cho phép xem kho sách và chi tiết sách.' },
  { id: 'p3', code: 'PRODUCTS_CREATE', name: 'Thêm sách mới', module: 'Sách', description: 'Cho phép thêm sách mới vào hệ thống.' },
  { id: 'p4', code: 'PRODUCTS_EDIT', name: 'Chỉnh sửa sách', module: 'Sách', description: 'Cho phép cập nhật thông tin và số lượng sách.' },
  { id: 'p5', code: 'PRODUCTS_DELETE', name: 'Xóa sách', module: 'Sách', description: 'Cho phép xóa sách khỏi hệ thống.' },
  { id: 'p6', code: 'ORDERS_VIEW', name: 'Xem danh sách đơn hàng', module: 'Đơn hàng', description: 'Cho phép xem thông tin và chi tiết tất cả đơn hàng.' },
  { id: 'p7', code: 'ORDERS_STATUS', name: 'Cập nhật đơn hàng', module: 'Đơn hàng', description: 'Cho phép thay đổi trạng thái đơn hàng (Duyệt, Hủy, Vận chuyển, v.v.).' },
  { id: 'p8', code: 'EMPLOYEES_VIEW', name: 'Xem danh sách nhân viên', module: 'Nhân viên', description: 'Cho phép xem danh sách và thông tin nhân sự cửa hàng.' },
  { id: 'p9', code: 'EMPLOYEES_MANAGE', name: 'Quản lý nhân viên', module: 'Nhân viên', description: 'Cho phép thêm, sửa thông tin, khóa tài khoản và xóa nhân viên.' },
  { id: 'p10', code: 'CUSTOMERS_VIEW', name: 'Xem danh sách khách hàng', module: 'Khách hàng', description: 'Cho phép xem thông tin thành viên mua hàng.' },
  { id: 'p11', code: 'CUSTOMERS_LOCK', name: 'Khóa khách hàng', module: 'Khách hàng', description: 'Cho phép khóa hoặc mở khóa tài khoản thành viên.' },
  { id: 'p25', code: 'CUSTOMERS_EDIT', name: 'Sửa thông tin khách hàng', module: 'Khách hàng', description: 'Cho phép thêm mới, chỉnh sửa thông tin hoặc xóa tài khoản khách hàng.' },
  { id: 'p12', code: 'PERMISSIONS_MANAGE', name: 'Quản lý phân quyền', module: 'Quyền', description: 'Cho phép cấu hình danh mục quyền và cấu hình vai trò (Role Permissions).' },
  { id: 'p13', code: 'EMPLOYEES_EXPORT', name: 'Xuất Excel nhân viên', module: 'Nhân viên', description: 'Cho phép xuất danh sách nhân viên ra file Excel.' },
  { id: 'p14', code: 'SETTINGS_MANAGE', name: 'Quản lý cài đặt hệ thống', module: 'Hệ thống', description: 'Cho phép cấu hình cửa hàng, biểu phí, thuế và sao lưu dữ liệu.' },
  { id: 'p15', code: 'NEWS_VIEW', name: 'Xem danh sách tin tức', module: 'Tin tức', description: 'Cho phép truy cập trang quản lý tin tức và xem danh sách bài viết.' },
  { id: 'p16', code: 'NEWS_CREATE', name: 'Đăng tin tức mới', module: 'Tin tức', description: 'Cho phép viết và đăng bài viết tin tức mới lên hệ thống.' },
  { id: 'p17', code: 'NEWS_EDIT', name: 'Chỉnh sửa tin tức', module: 'Tin tức', description: 'Cho phép cập nhật nội dung, tiêu đề và ảnh của bài viết đã đăng.' },
  { id: 'p18', code: 'NEWS_DELETE', name: 'Xóa tin tức', module: 'Tin tức', description: 'Cho phép xóa bài viết tin tức khỏi hệ thống.' },
  { id: 'p19', code: 'CONTACT_VIEW', name: 'Xem danh sách liên hệ', module: 'Liên hệ', description: 'Cho phép truy cập trang quản lý liên hệ và xem danh sách tin nhắn từ khách hàng.' },
  { id: 'p20', code: 'CONTACT_REPLY', name: 'Phản hồi liên hệ', module: 'Liên hệ', description: 'Cho phép phản hồi tin nhắn liên hệ từ khách hàng.' },
  { id: 'p21', code: 'CONTACT_ARCHIVE', name: 'Lưu trữ liên hệ', module: 'Liên hệ', description: 'Cho phép chuyển tin nhắn liên hệ vào kho lưu trữ.' },
  { id: 'p22', code: 'CONTACT_DELETE', name: 'Xóa liên hệ', module: 'Liên hệ', description: 'Cho phép xóa vĩnh viễn tin nhắn liên hệ khỏi hệ thống.' },
  { id: 'p23', code: 'REVIEWS_VIEW', name: 'Xem danh sách đánh giá', module: 'Đánh giá', description: 'Cho phép xem danh sách và chi tiết đánh giá sách.' },
  { id: 'p24', code: 'REVIEWS_DELETE', name: 'Xóa đánh giá', module: 'Đánh giá', description: 'Cho phép xóa hoặc ẩn các đánh giá không phù hợp.' },
  { id: 'p27', code: 'PROMOTIONS_VIEW', name: 'Xem mã giảm giá', module: 'Khuyến mãi', description: 'Cho phép truy cập danh sách mã giảm giá, xem điều kiện và lượt sử dụng.' },
  { id: 'p28', code: 'PROMOTIONS_CREATE', name: 'Tạo mã giảm giá', module: 'Khuyến mãi', description: 'Cho phép tạo chương trình khuyến mãi và mã giảm giá mới.' },
  { id: 'p29', code: 'PROMOTIONS_EDIT', name: 'Chỉnh sửa mã giảm giá', module: 'Khuyến mãi', description: 'Cho phép cập nhật điều kiện, thời gian và trạng thái mã giảm giá.' },
  { id: 'p30', code: 'PROMOTIONS_DELETE', name: 'Xóa mã giảm giá', module: 'Khuyến mãi', description: 'Cho phép xóa mã chưa phát sinh lượt sử dụng.' },
  { id: 'p26', code: 'EMAIL_MANAGE', name: 'Quản lý Email & Nhật ký gửi', module: 'Email', description: 'Cho phép xem nhật ký gửi email, cấu hình mẫu email và gửi email thủ công cho khách hàng.' },
  { id: 'p31', code: 'CHAT_VIEW', name: 'Xem hộp thư Chat hỗ trợ', module: 'Hỗ trợ Chat', description: 'Cho phép truy cập và xem danh sách các cuộc trò chuyện của khách hàng.' },
  { id: 'p32', code: 'CHAT_REPLY', name: 'Phản hồi tin nhắn Chat', module: 'Hỗ trợ Chat', description: 'Cho phép gửi tin nhắn trả lời và tư vấn cho khách hàng qua Live Chat.' },
  { id: 'p33', code: 'CHAT_MANAGE', name: 'Quản lý cuộc hội thoại', module: 'Hỗ trợ Chat', description: 'Cho phép đóng/mở lại phiên chat, xóa hội thoại hoặc gán nhãn hỗ trợ.' }
];

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'r1',
    code: 'admin',
    name: 'Quản trị viên (Super Admin)',
    description: 'Có toàn quyền kiểm soát tất cả các chức năng hệ thống.',
    permissions: ['DASHBOARD_VIEW', 'PRODUCTS_VIEW', 'PRODUCTS_CREATE', 'PRODUCTS_EDIT', 'PRODUCTS_DELETE', 'ORDERS_VIEW', 'ORDERS_STATUS', 'EMPLOYEES_VIEW', 'EMPLOYEES_MANAGE', 'EMPLOYEES_EXPORT', 'CUSTOMERS_VIEW', 'CUSTOMERS_LOCK', 'CUSTOMERS_EDIT', 'PERMISSIONS_MANAGE', 'SETTINGS_MANAGE', 'NEWS_VIEW', 'NEWS_CREATE', 'NEWS_EDIT', 'NEWS_DELETE', 'CONTACT_VIEW', 'CONTACT_REPLY', 'CONTACT_ARCHIVE', 'CONTACT_DELETE', 'REVIEWS_VIEW', 'REVIEWS_DELETE', 'PROMOTIONS_VIEW', 'PROMOTIONS_CREATE', 'PROMOTIONS_EDIT', 'PROMOTIONS_DELETE', 'EMAIL_MANAGE', 'CHAT_VIEW', 'CHAT_REPLY', 'CHAT_MANAGE']
  },
  {
    id: 'r2',
    code: 'manager',
    name: 'Quản lý cửa hàng (Manager)',
    description: 'Quản lý vận hành hàng ngày của cửa hàng sách.',
    permissions: ['DASHBOARD_VIEW', 'PRODUCTS_VIEW', 'PRODUCTS_CREATE', 'PRODUCTS_EDIT', 'PRODUCTS_DELETE', 'ORDERS_VIEW', 'ORDERS_STATUS', 'CUSTOMERS_VIEW', 'CUSTOMERS_LOCK', 'CUSTOMERS_EDIT', 'NEWS_VIEW', 'CONTACT_VIEW', 'CONTACT_REPLY', 'CONTACT_ARCHIVE', 'REVIEWS_VIEW', 'REVIEWS_DELETE', 'PROMOTIONS_VIEW', 'PROMOTIONS_CREATE', 'PROMOTIONS_EDIT', 'PROMOTIONS_DELETE', 'EMAIL_MANAGE', 'CHAT_VIEW', 'CHAT_REPLY']
  },
  {
    id: 'r3',
    code: 'sales',
    name: 'Nhân viên bán hàng (Sales Staff)',
    description: 'Chuyên xử lý đơn hàng và hỗ trợ bán hàng tại quầy.',
    permissions: ['PRODUCTS_VIEW', 'ORDERS_VIEW', 'ORDERS_STATUS', 'PROMOTIONS_VIEW']
  },
  {
    id: 'r4',
    code: 'editor',
    name: 'Biên tập viên nội dung (Content Editor)',
    description: 'Chuyên cập nhật danh mục, mô tả và nhập kho sách.',
    permissions: ['PRODUCTS_VIEW', 'PRODUCTS_CREATE', 'PRODUCTS_EDIT', 'NEWS_VIEW', 'NEWS_CREATE', 'NEWS_EDIT']
  },
  {
    id: 'r5',
    code: 'customer_care',
    name: 'Chăm sóc khách hàng (Customer Care)',
    description: 'Chuyên giải đáp thắc mắc và quản lý danh sách thành viên.',
    permissions: ['CUSTOMERS_VIEW', 'CUSTOMERS_LOCK', 'CUSTOMERS_EDIT', 'ORDERS_VIEW', 'CONTACT_VIEW', 'CONTACT_REPLY', 'CONTACT_ARCHIVE', 'REVIEWS_VIEW', 'REVIEWS_DELETE', 'CHAT_VIEW', 'CHAT_REPLY', 'CHAT_MANAGE']
  }
];

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private storageService = inject(StorageService);
  private employeeService = inject(EmployeeService);

  private permissionsKey = 'system_permissions';
  private rolesKey = 'role_permissions';

  permissions = signal<Permission[]>([]);
  roles = signal<Role[]>([]);

  constructor() {
    this.loadData();
  }

  private loadData() {
    let loadedPermissions = this.storageService.getOrCreate<Permission[]>(this.permissionsKey, DEFAULT_PERMISSIONS);
    let loadedRoles = this.storageService.getOrCreate<Role[]>(this.rolesKey, DEFAULT_ROLES);

    // Đồng bộ các quyền mặc định mới mà không ghi đè cấu hình quyền cũ của quản trị viên.
    const missingPerms = DEFAULT_PERMISSIONS.filter(
      (defPerm) => !loadedPermissions.some((permission) => permission.code === defPerm.code)
    );
    const missingCodes = new Set(missingPerms.map(permission => permission.code));

    if (missingPerms.length > 0) {
      loadedPermissions = [...loadedPermissions, ...missingPerms];

      // Chỉ gán các quyền VỪA được bổ sung cho các vai trò có quyền đó trong cấu hình mặc định.
      // Các quyền cũ mà quản trị viên từng chủ động thu hồi sẽ không bị tự động thêm lại.
      loadedRoles = loadedRoles.map(role => {
        const defaultRole = DEFAULT_ROLES.find(item => item.code === role.code);
        if (!defaultRole) return role;
        const additions = defaultRole.permissions.filter(code => missingCodes.has(code) && !role.permissions.includes(code));
        return additions.length > 0 ? { ...role, permissions: [...role.permissions, ...additions] } : role;
      });

      this.storageService.set(this.permissionsKey, loadedPermissions);
      this.storageService.set(this.rolesKey, loadedRoles);
    }

    // Super Admin luôn có đầy đủ toàn bộ quyền hệ thống.
    const adminRole = loadedRoles.find(role => role.code === 'admin');
    if (adminRole) {
      DEFAULT_PERMISSIONS.forEach(defaultPermission => {
        if (!adminRole.permissions.includes(defaultPermission.code)) {
          adminRole.permissions.push(defaultPermission.code);
        }
      });
      this.storageService.set(this.rolesKey, loadedRoles);
    }

    this.permissions.set(loadedPermissions);
    this.roles.set(loadedRoles);
  }

  private saveData() {
    this.storageService.set(this.permissionsKey, this.permissions());
    this.storageService.set(this.rolesKey, this.roles());
  }

  // Permission actions
  addPermission(permission: Permission) {
    this.permissions.update((p) => [...p, permission]);
    this.saveData();
  }

  updatePermission(updated: Permission) {
    this.permissions.update((p) => p.map((x) => (x.id === updated.id ? updated : x)));
    this.saveData();
  }

  deletePermission(id: string) {
    const permToDelete = this.permissions().find(p => p.id === id);
    if (!permToDelete) return;

    // Do not allow deleting core system permissions
    const isCore = DEFAULT_PERMISSIONS.some(p => p.code === permToDelete.code);
    if (isCore) {
      throw new Error('Không thể xóa quyền hệ thống mặc định.');
    }

    this.permissions.update((p) => p.filter((x) => x.id !== id));

    // Also remove this permission code from any roles that contain it
    this.roles.update((rList) => rList.map(r => ({
      ...r,
      permissions: r.permissions.filter(pCode => pCode !== permToDelete.code)
    })));

    this.saveData();
    this.syncAllUserPermissionsFromRoles();
  }

  // Role actions
  addRole(role: Role) {
    this.roles.update((r) => [...r, role]);
    this.saveData();
  }

  updateRole(updated: Role) {
    this.roles.update((r) => r.map((x) => (x.id === updated.id ? updated : x)));
    this.saveData();
    this.syncAllUserPermissionsFromRoles();
  }

  deleteRole(id: string) {
    const roleToDelete = this.roles().find(r => r.id === id);
    if (!roleToDelete) return;

    if (roleToDelete.code === 'admin') {
      throw new Error('Không thể xóa vai trò quản trị viên tối cao.');
    }

    this.roles.update((r) => r.filter((x) => x.id !== id));
    this.saveData();
  }

  // Assign permissions to a role
  assignPermissionsToRole(roleCode: string, permissionCodes: string[]) {
    this.roles.update((rList) => rList.map((r) => {
      if (r.code === roleCode) {
        return { ...r, permissions: permissionCodes };
      }
      return r;
    }));
    this.saveData();
    this.syncAllUserPermissionsFromRoles();
  }

  // Sync users' permissions who have this role
  syncAllUserPermissionsFromRoles() {
    const users = this.employeeService.users();
    const roles = this.roles();

    users.forEach(user => {
      const matchedRole = roles.find(r => r.code === user.role);
      if (matchedRole) {
        user.permissions = [...matchedRole.permissions];
        this.employeeService.updateUser(user);
      }
    });
  }

  // Assign role to a specific user
  assignRoleToUser(userId: string, roleCode: string) {
    const users = this.employeeService.users();
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (user.username === 'admin') {
      throw new Error('Không thể thay đổi vai trò của quản trị viên tối cao.');
    }

    const matchedRole = this.roles().find(r => r.code === roleCode);
    if (!matchedRole) return;

    user.role = roleCode;
    user.permissions = [...matchedRole.permissions];

    this.employeeService.updateUser(user);
  }
}
