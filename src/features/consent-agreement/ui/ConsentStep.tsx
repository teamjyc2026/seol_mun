'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/shared/lib/cn';

function FieldError({ name }: { name: string }) {
  const { formState } = useFormContext();
  const top = (formState.errors as Record<string, { message?: string } | undefined>)?.consent as
    | Record<string, { message?: string } | undefined>
    | undefined;
  const msg = top?.[name]?.message;
  if (!msg) return null;
  return <p className="mt-1 text-sm font-medium text-rose-600">{String(msg)}</p>;
}

export function ConsentStep() {
  const { control, register } = useFormContext();
  return (
    <div className="space-y-5">
      <Card className="border-zinc-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-zinc-700" />
            개인정보 수집·이용 동의서
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-zinc-600">
          <Item title="1. 수집 및 이용 목적">
            설문조사 결과 분석, 프로그램 참여자 확인 및 안내, 사은품 발송
          </Item>
          <Item title="2. 수집 항목 (필수)">
            성명, 연락처(휴대폰 번호), 소속(학교/학년), 이메일 주소
          </Item>
          <Item title="3. 보유 및 이용 기간">
            동의일로부터 2년. 목적 달성 시 지체 없이 파기합니다.
          </Item>
          <Item title="4. 동의 거부 권리">
            동의를 거부할 수 있으나, 거부 시 설문 참여 및 사은품 발송 대상에서 제외될 수 있습니다.
          </Item>
        </CardContent>
      </Card>

      <Controller
        control={control}
        name="consent.privacy_agreed"
        render={({ field }) => (
          <label
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition',
              field.value
                ? 'border-zinc-900 ring-2 ring-zinc-900'
                : 'border-zinc-200 hover:border-zinc-300',
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-zinc-900"
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
            <div className="text-sm">
              <p className="font-semibold text-zinc-900">
                [필수] 위 개인정보 수집·이용에 동의합니다.
              </p>
              <p className="mt-1 text-zinc-500">
                동의해야 응답 제출이 가능합니다.
              </p>
              <FieldError name="privacy_agreed" />
            </div>
          </label>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="성명" htmlFor="consent-name">
          <Input
            id="consent-name"
            placeholder="홍길동"
            autoComplete="name"
            {...register('consent.name')}
          />
          <FieldError name="name" />
        </Field>
        <Field label="휴대폰" htmlFor="consent-phone">
          <Input
            id="consent-phone"
            placeholder="010-1234-5678"
            autoComplete="tel"
            inputMode="tel"
            {...register('consent.phone')}
          />
          <FieldError name="phone" />
        </Field>
        <Field label="소속 (학교 / 학년)" htmlFor="consent-affiliation">
          <Input
            id="consent-affiliation"
            placeholder="OO중학교 2학년"
            {...register('consent.affiliation')}
          />
          <FieldError name="affiliation" />
        </Field>
        <Field label="이메일" htmlFor="consent-email">
          <Input
            id="consent-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            {...register('consent.email')}
          />
          <FieldError name="email" />
        </Field>
      </div>
    </div>
  );
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-zinc-700">{title}</p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-zinc-800">
        {label}
      </Label>
      {children}
    </div>
  );
}
