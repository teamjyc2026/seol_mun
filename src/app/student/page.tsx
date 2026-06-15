import { getStudent } from '@/shared/config/auth';
import { StudentAuthPage, StudentAgentPage } from '@/pages-fsd/student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function Page() {
  const student = await getStudent();
  if (!student) {
    return <StudentAuthPage />;
  }
  return <StudentAgentPage student={student} />;
}
