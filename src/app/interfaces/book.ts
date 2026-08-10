export interface Book {
  id: string;
  title: string;
  image: string;
  category: string;
  author: string;
  description: string;
  pages: number;
  price: number;
  discount: string;
  stock: number;
  publishDate: string;
  translator: string;
  sampleText?: string;
  tableOfContents?: string;
}
