'use client';

import React from 'react';
import { Container, HeadingL, HeadingM, BodyM, Section } from '@/components/ui';

const FAQ_ITEMS = [
  {
    question: 'How does billing work?',
    answer:
      'Choose Locker Room, Film Room, or War Room. You are billed monthly and can upgrade or downgrade at any time.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. Cancel from your account settings — access continues through the end of your billing period.',
  },
  {
    question: 'What do I get with Insider access?',
    answer:
      'Full FutureCast predictions, Film Room breakdowns, War Room intel, insider chat, and complete portal/NIL tracking.',
  },
] as const;

export function InsiderFAQ(): React.ReactElement {
  return (
    <Section className="insider-section insider-section--alt" data-testid="insider-faq">
      <Container>
        <div className="insider-section__header">
          <HeadingL>FAQ</HeadingL>
        </div>
        <div className="insider-faq">
          {FAQ_ITEMS.map((item) => (
            <article key={item.question} className="gv-ds-card insider-faq__item">
              <HeadingM>{item.question}</HeadingM>
              <BodyM>{item.answer}</BodyM>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
