import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { CustomerService, CustomerProfilePatch } from '../../services/customer.service';
import { EmployeeService } from '../../services/employee.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private customerService = inject(CustomerService);
  private employeeService = inject(EmployeeService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  currentUser = this.authService.currentUser;
  profileForm!: FormGroup;
  avatarPreview = signal<string>('');
  successMessage = signal<string>('');
  errorMessage = signal<string>('');
  activeTab = signal<string>('personal');
  glowTransform = signal<string>('translate3d(-999px, -999px, 0px)');
  isLoading = signal<boolean>(true);
  isSaving = signal<boolean>(false);

  onMouseMove(event: MouseEvent): void {
    this.glowTransform.set(`translate3d(${event.clientX - 120}px, ${event.clientY - 120}px, 0px)`);
  }

  ngOnInit(): void {
    const user = this.currentUser();
    if (!user) {
      void this.router.navigate(['/login']);
      return;
    }

    this.profileForm = this.fb.group({
      fullname: ['', [Validators.required, Validators.minLength(2)]],
      email: [{ value: '', disabled: true }],
      phone: ['', [Validators.pattern(/^[0-9]{9,11}$/)]],
      address: [''],
      gender: ['nam'],
      dob: ['']
    });

    void this.loadUserProfile();
  }

  private async loadUserProfile(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      if (user.role === 'customer') {
        const customer = await firstValueFrom(
          this.customerService.getLatestCustomer(String(user.id || ''), String(user.email || ''))
        );

        this.profileForm.patchValue({
          fullname: customer.fullname || '',
          email: customer.email || '',
          phone: customer.phone || '',
          address: customer.address || '',
          gender: customer.gender || 'nam',
          dob: customer.dob || ''
        }, { emitEvent: false });

        this.avatarPreview.set(customer.avatar || '');
        this.authService.updateCurrentUserDetails({
          name: customer.fullname || customer.username,
          avatar: customer.avatar || ''
        });
      } else {
        const employees = this.employeeService.getEmployees();
        const employee = employees.find(item =>
          String(item.id) === String(user.id) ||
          item.email?.toLowerCase() === String(user.email || '').toLowerCase()
        );

        if (!employee) {
          throw new Error('Không tìm thấy thông tin nhân sự.');
        }

        this.profileForm.patchValue({
          fullname: employee.fullname || '',
          email: employee.email || '',
          phone: employee.phone || '',
          address: employee.address || '',
          gender: employee.gender || 'nam',
          dob: employee.dob || ''
        }, { emitEvent: false });
        this.avatarPreview.set(employee.image || '');
      }
    } catch (error) {
      console.error('Không thể tải hồ sơ mới nhất:', error);
      this.errorMessage.set('Không thể tải thông tin mới nhất từ máy chủ. Vui lòng kiểm tra server cổng 3000.');
    } finally {
      this.isLoading.set(false);
    }
  }

  onAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 120;
        let width = image.width;
        let height = image.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return;

        context.drawImage(image, 0, 0, width, height);
        this.avatarPreview.set(canvas.toDataURL('image/jpeg', 0.7));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  }

  async onSubmit(): Promise<void> {
    if (this.isSaving()) return;

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const user = this.currentUser();
    if (!user) return;

    this.successMessage.set('');
    this.errorMessage.set('');
    this.isSaving.set(true);

    try {
      const formValues = this.profileForm.getRawValue();

      if (user.role === 'customer') {
        const profilePatch: CustomerProfilePatch = {
          fullname: String(formValues.fullname || '').trim(),
          phone: String(formValues.phone || '').trim(),
          address: String(formValues.address || '').trim(),
          gender: String(formValues.gender || 'nam'),
          dob: String(formValues.dob || ''),
          avatar: this.avatarPreview()
        };

        const savedCustomer = await firstValueFrom(
          this.customerService.updateProfile(String(user.id), profilePatch)
        );

        // Chỉ cập nhật giao diện sau khi server đã lưu thật thành công.
        this.profileForm.patchValue({
          fullname: savedCustomer.fullname || '',
          email: savedCustomer.email || '',
          phone: savedCustomer.phone || '',
          address: savedCustomer.address || '',
          gender: savedCustomer.gender || 'nam',
          dob: savedCustomer.dob || ''
        }, { emitEvent: false });
        this.avatarPreview.set(savedCustomer.avatar || '');
        this.authService.updateCurrentUserDetails({
          name: savedCustomer.fullname || savedCustomer.username,
          avatar: savedCustomer.avatar || ''
        });
      } else {
        const employee = this.employeeService.getEmployees().find(item =>
          String(item.id) === String(user.id) ||
          item.email?.toLowerCase() === String(user.email || '').toLowerCase()
        );

        if (!employee) {
          throw new Error('Không tìm thấy tài khoản nhân sự.');
        }

        const savedEmployee = await firstValueFrom(
          this.employeeService.updateEmployeeObservable({
            ...employee,
            fullname: String(formValues.fullname || '').trim(),
            phone: String(formValues.phone || '').trim(),
            address: String(formValues.address || '').trim(),
            gender: String(formValues.gender || 'nam'),
            dob: String(formValues.dob || ''),
            image: this.avatarPreview()
          })
        );

        this.authService.updateCurrentUserDetails({
          name: savedEmployee.fullname,
          avatar: savedEmployee.image || ''
        });
      }

      this.successMessage.set('Cập nhật thông tin cá nhân thành công!');
      setTimeout(() => this.successMessage.set(''), 4000);
    } catch (error) {
      console.error('Lỗi cập nhật hồ sơ:', error);
      this.errorMessage.set('Thông tin chưa được lưu. Vui lòng kiểm tra server và thử lại.');
      setTimeout(() => this.errorMessage.set(''), 5000);
    } finally {
      this.isSaving.set(false);
    }
  }
}
