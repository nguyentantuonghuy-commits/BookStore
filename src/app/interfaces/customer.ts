export interface Customer {
  id?: string;
  username: string;
  password: string;
  fullname: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  islocked: boolean;
  avatar?: string;
  gender?: string;
  dob?: string;
  isGoogleAccount?: boolean;
}

export const CUSTOMERS: Customer[] = [
  {
    id: 'cus1',
    username: 'acb',
    password: '123456',
    fullname: 'ACB',
    email: 'acb@gmail.com',
    phone: '0909000888',
    address: '12 ABC Q1 Tp.HCM',
    role: 'customer',
    islocked: false,
  },
  {
    id: 'cus2',
    username: 'ocb',
    password: '123456',
    fullname: 'OCB',
    email: 'ocb@gmail.com',
    phone: '0909000888',
    address: '12 OCB Q1 Tp.HCM',
    role: 'customer',
    islocked: false,
  },
  {
    id: 'cus3',
    username: 'hcb',
    password: '123456',
    fullname: 'HCB',
    email: 'hcb@gmail.com',
    phone: '0909000888',
    address: '12 HCB Q1 Tp.HCM',
    role: 'customer',
    islocked: false,
  },
];
