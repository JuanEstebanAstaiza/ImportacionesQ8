export interface Importer {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  responseTime: string;
  initials: string;
  color: string;
  memberSince: string;
  projects: number;
  verified: boolean;
  country: string;
  categories: string[];
  advisor: {
    name: string;
    role: string;
    initials: string;
    color: string;
    email: string;
  };
}