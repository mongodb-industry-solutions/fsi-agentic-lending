"use client";
import Code from '@leafygreen-ui/code';

export default function CodeSnippet({ code, language = 'javascript' }) {
  if (!code) return null;
  return (
    <Code language={language} copyButtonAppearance="hover">
      {code}
    </Code>
  );
}
