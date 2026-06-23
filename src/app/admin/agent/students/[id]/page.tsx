import { redirect } from 'next/navigation';
import { StudentDetailPage } from '@/pages-fsd/students';
import { getStudentRecord } from '@/entities/student/server';
import { getUploaderId } from '@/shared/config/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getUploaderId())) {
    redirect('/admin/login?as=uploader');
  }
  const { id } = await params;
  const record = await getStudentRecord(id);
  return <StudentDetailPage record={record} />;
}
