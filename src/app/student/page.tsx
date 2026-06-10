import { getStudent } from '@/shared/config/auth';
import { listSchools } from '@/entities/school/api/listSchools';
import { StudentAuthPage, StudentAgentPage } from '@/pages-fsd/student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  const student = await getStudent();
  if (!student) {
    return <StudentAuthPage />;
  }
  const schools = await listSchools();
  return <StudentAgentPage student={student} schools={schools} />;
}
