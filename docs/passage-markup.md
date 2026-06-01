# 지문 마크업 태그 (Passage Markup)

수능 영어 등 지문/문항의 시각 서식(밑줄·박스·원문자·문단·빈칸)을 **본문 텍스트 안에 끼워 넣는 HTML 유사 경량 태그**로 표현한다. DB 스키마 변경 없이 기존 `passage`/`question`/`choices`/`explanation` text 컬럼에 평문으로 저장된다.

- 파서: `src/shared/lib/richText/parseRichText.ts`
- 렌더러: `src/shared/ui/RichText/RichText.tsx` (`<RichText text={...} />`)
- 평문화: `src/shared/lib/richText/stripRichText.ts` (테이블 미리보기·임베딩 입력용)

## 적용되는 필드

`passage`(지문) · `question`(질문) · `choices[].text`(보기) · `explanation`(해설). 정답(`answer`) 표시에도 렌더된다.

## 태그 목록

| 의미 | 문법 | 렌더 결과 | 주 용도 |
|------|------|-----------|---------|
| 밑줄 | `<u>word</u>` | 밑줄 | 일반 강조 |
| 번호 밑줄 | `<u n="1">word</u>` | `①` 위첨자 + 밑줄 | 어법/어휘 선택지 ①~⑤ |
| 박스/네모 | `<box>word</box>` | 테두리 박스 | 어휘 택1, 핵심어 강조 |
| 원문자 마커 | `<num>③</num>` 또는 `<num n="3"/>` | 강조된 원문자 | 문장 삽입 위치 표시 |
| 문단 | `<p label="A">First...</p>` | 줄바꿈 블록 + `(A)` 라벨 | 글의 순서 (A)(B)(C) |
| 빈칸 | `<blank/>` 또는 `<blank>____</blank>` | 고정폭 밑줄 빈칸 | 빈칸추론 |
| 굵게 | `<b>word</b>` | 굵게 | 일반 강조 |

`n` 값은 `1`~`10` 숫자(자동으로 `①`~`⑩` 변환)거나 원문자 자체를 직접 넣어도 된다.

## 유형별 예시

**어법 (밑줄 친 부분 중 어법상 틀린 것):**
```
The book <u n="1">which</u> I read was <u n="2">interesting</u>, and it <u n="3">make</u> me <u n="4">think</u> <u n="5">deeply</u>.
```

**어휘 (네모 안 택1):**
```
He decided to <box>accept / except</box> the offer.
```

**문장 삽입 (글의 흐름상 가장 적절한 위치):**
```
<num>①</num> Cities grew fast. <num>②</num> Roads spread. <num>③</num> Pollution followed. <num>④</num> People reacted. <num>⑤</num>
```

**글의 순서 ((A)(B)(C)):**
```
Climate is changing.
<p label="A">First, temperatures rose...</p>
<p label="B">Then, ice melted...</p>
<p label="C">Finally, seas rose...</p>
```

**빈칸추론:**
```
The key to success is <blank/> rather than luck.
```

## 파서 규칙 (안전·폴백)

1. **화이트리스트만 인식** — `u box num p blank b` 외의 `<...>`는 모두 평문으로 표시된다. 따라서 `x < y`, `a <div> b` 같은 텍스트는 그대로 보인다(이스케이프 불필요).
2. **임의 HTML 주입 없음** — 렌더러는 화이트리스트 태그를 React 노드로 매핑할 뿐 `dangerouslySetInnerHTML`을 쓰지 않는다.
3. **중첩 허용** — `<box><u>x</u></box>` 가능.
4. **짝 안 맞으면 평문 폴백** — 닫히지 않은 `<u>`나 짝 없는 `</u>`는 원문 텍스트 그대로 보인다(깨지지 않음).
5. **속성** — `n`(번호), `label`(문단 라벨)만 인식하며 큰따옴표/작은따옴표 모두 허용.
6. **줄바꿈 보존** — 본문의 개행은 `whitespace-pre-wrap`으로 유지된다.

## LLM 생성

`buildProblemSystemPrompt`(`src/shared/agent/prompts.ts`)에 위 태그 사용 지침이 포함돼, 문제 생성 시 필요한 경우 자동으로 태그가 출력된다.

## 새 태그를 추가하려면

1. `parseRichText.ts`의 `RICH_TAGS` 배열에 태그명 추가
2. 속성이 있으면 `RichAttrs` 타입과 `parseAttrs`에 키 추가
3. `RichText.tsx`의 `renderNode` switch에 렌더 케이스 추가
4. 필요 시 `stripRichText.ts`의 평문 변환 처리 추가
5. 이 문서와 `RICH_TEXT_HINT`(`RichTextPreview.tsx`) 갱신
