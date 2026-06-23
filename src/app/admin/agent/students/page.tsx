import { redirect } from 'next/navigation';
import { StudentsPage } from '@/pages-fsd/students';
import { listStudentsWithStats } from '@/entities/student/server';
import { getUploaderId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  const students = await listStudentsWithStats();
  return <StudentsPage initialStudents={students} />;
}
