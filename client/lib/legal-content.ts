import { LEGAL_ENTITY_NAME, SUPPORT_EMAIL } from './legal-entity';

export type LegalSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  id: 'privacy' | 'terms';
  title: string;
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
  contactEmail: string;
};

const CONTACT_EMAIL = SUPPORT_EMAIL;
const EFFECTIVE_DATE = 'July 21, 2026';

export const PRIVACY_POLICY: LegalDocument = {
  id: 'privacy',
  title: 'Privacy Policy',
  effectiveDate: EFFECTIVE_DATE,
  contactEmail: CONTACT_EMAIL,
  intro: `${LEGAL_ENTITY_NAME} ("GatorVault," "we," "us," or "our") operates gatorvaultinsider.com and related membership services for Florida Gators football fans. This Privacy Policy explains what information we collect, how we use it, and the choices you have.`,
  sections: [
    {
      id: 'entity',
      heading: 'Who we are',
      paragraphs: [
        `${LEGAL_ENTITY_NAME} is a Florida limited liability company. References to "GatorVault" or "GatorVault Insider" in this policy mean ${LEGAL_ENTITY_NAME}.`,
      ],
    },
    {
      id: 'collect',
      heading: 'Information we collect',
      paragraphs: ['We collect information you provide directly and information generated when you use the service.'],
      bullets: [
        'Account details: name, email address, and password (stored using industry-standard hashing on our servers).',
        'Membership tier and trial status associated with your account.',
        'Community content you post in forums or live rooms, including text you submit and timestamps.',
        'Alert and display preferences saved in your browser (for example, notification method preferences).',
        'Technical data such as browser type, device type, and pages viewed, used to operate and improve the product.',
      ],
    },
    {
      id: 'use',
      heading: 'How we use information',
      paragraphs: ['We use your information to operate GatorVault and deliver the membership experience you signed up for.'],
      bullets: [
        'Authenticate you and maintain your session.',
        'Provide recruiting intel, FutureCast, film, schedule, and other Insider features.',
        'Send service-related email (for example, welcome or account notices) when applicable.',
        'Moderate community content and respond to abuse reports.',
        'Monitor reliability, prevent fraud, and improve performance.',
      ],
    },
    {
      id: 'storage',
      heading: 'Storage and session data',
      paragraphs: [
        'When you sign in, an encrypted session token is stored in your browser so you stay logged in. We also store theme and alert preferences locally on your device. We do not use third-party advertising cookies.',
      ],
    },
    {
      id: 'sharing',
      heading: 'Sharing and service providers',
      paragraphs: [
        'We do not sell your personal information. We share data only with infrastructure and service providers that help us run the platform (for example, hosting, email delivery, and analytics needed for operations), and only as required for them to perform those services.',
        'Community posts you choose to publish are visible to other members according to the product experience.',
      ],
    },
    {
      id: 'retention',
      heading: 'Data retention and deletion',
      paragraphs: [
        'We retain account information while your membership is active and for a reasonable period afterward for legal, security, and operational purposes.',
        'Signed-in members can delete their account from Membership in the Vault (/vault/membership/). Deletion removes login credentials, membership profile data, and Vault Points. Community posts may remain visible with the author shown as "Deleted member."',
        `You may also request account deletion or a copy of your data by emailing ${CONTACT_EMAIL}. We will verify ownership of the account before processing requests.`,
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      paragraphs: [
        'GatorVault is not directed to children under 13, and we do not knowingly collect personal information from children under 13. Contact us if you believe a child has provided us information.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      paragraphs: [
        'We may update this Privacy Policy from time to time. We will post the revised policy on this page and update the effective date above.',
      ],
    },
  ],
};

export const MEMBERSHIP_TERMS: LegalDocument = {
  id: 'terms',
  title: 'Membership Terms',
  effectiveDate: EFFECTIVE_DATE,
  contactEmail: CONTACT_EMAIL,
  intro: `These Membership Terms ("Terms") govern your access to GatorVault Insider features at gatorvaultinsider.com, operated by ${LEGAL_ENTITY_NAME}. By creating an account or using paid or trial membership, you agree to these Terms and our Privacy Policy.`,
  sections: [
    {
      id: 'entity',
      heading: 'Operator',
      paragraphs: [
        `${LEGAL_ENTITY_NAME} ("GatorVault") operates the GatorVault Insider service. GatorVault is an independent fan platform and is not affiliated with, endorsed by, or sponsored by the University of Florida or UF Athletics.`,
      ],
    },
    {
      id: 'service',
      heading: 'The service',
      paragraphs: [
        'GatorVault provides Florida Gators football coverage including recruiting intelligence, FutureCast, film analysis, schedules, NIL tracking, community discussion, and related Insider tools. Features may vary by membership tier.',
      ],
    },
    {
      id: 'accounts',
      heading: 'Accounts and eligibility',
      paragraphs: ['You must provide accurate registration information and keep your credentials secure.'],
      bullets: [
        'You are responsible for activity under your account.',
        'One person per account unless we authorize otherwise.',
        'You must be at least 13 years old to use the service.',
      ],
    },
    {
      id: 'membership',
      heading: 'Membership, trial, and billing',
      paragraphs: [
        'GatorVault offers membership tiers (Locker Room, Film Room, and War Room) with different feature access. New accounts may receive a free trial as described at signup.',
        'When billing applies, you authorize recurring charges for the tier you select until you cancel. Pricing is shown before purchase. Taxes may apply where required by law.',
        'We may change pricing or features with notice; changes apply to subsequent billing periods unless otherwise stated.',
      ],
    },
    {
      id: 'cancel',
      heading: 'Cancellation and refunds',
      paragraphs: [
        'You may cancel renewal according to the cancellation method available in your account or by contacting support. Access generally continues through the end of the current paid period.',
        'Except where required by law, fees are non-refundable once a billing period has started.',
      ],
    },
    {
      id: 'conduct',
      heading: 'Acceptable use and community',
      paragraphs: ['You agree not to misuse the platform or harm other members.'],
      bullets: [
        'Do not harass, threaten, impersonate others, or post unlawful content.',
        'Do not scrape, reverse engineer, or overload our systems.',
        'Do not redistribute Insider content commercially without permission.',
        'Report problematic community content using in-product tools or by emailing support.',
      ],
    },
    {
      id: 'content',
      heading: 'Content and intellectual property',
      paragraphs: [
        `GatorVault content, branding, and product design are owned by ${LEGAL_ENTITY_NAME} or its licensors. Third-party names, logos, and marks belong to their respective owners.`,
        'You retain rights to content you submit, but grant us a license to host, display, and moderate it within the service.',
      ],
    },
    {
      id: 'disclaimer',
      heading: 'Disclaimers',
      paragraphs: [
        'Recruiting projections, FutureCast scores, and intel are informational and for entertainment purposes. They are not guarantees of recruiting outcomes.',
        'The service is provided "as is" to the fullest extent permitted by law. We do not warrant uninterrupted or error-free operation.',
      ],
    },
    {
      id: 'termination',
      heading: 'Suspension and termination',
      paragraphs: [
        'We may suspend or terminate accounts that violate these Terms or create risk for the community or platform. You may stop using the service at any time.',
      ],
    },
    {
      id: 'law',
      heading: 'Governing law and contact',
      paragraphs: [
        'These Terms are governed by the laws of the State of Florida, without regard to conflict-of-law rules.',
        `Questions about these Terms: ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const LEGAL_ROUTES = {
  privacy: '/privacy/',
  terms: '/terms/',
} as const;
