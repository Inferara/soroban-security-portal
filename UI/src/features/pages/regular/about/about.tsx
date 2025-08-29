import { FC } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const TextBlock = ({ children }: { children: React.ReactNode }) => {
  return (
    <Typography variant="body1" component="div" sx={{ pt: 2 }}>
      {children}
    </Typography>
  );
};

const H5 = ({ text }: { text: string }) => {
  return (
    <Typography variant="h5" component="h3" sx={{ pt: 2 }}>
      {text}
    </Typography>
  );
}

const ExternalLink = ({ url, text }: { url: string, text: string }) => {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  );
};

const InternalLink = ({ path, text }: { path: string, text: string }) => {
  return (
    <a href={path}>
      {text}
    </a>
  );
};

export const About: FC = () => {
  return (
    <Box component="div" sx={{ p: 3, minHeight: '80vh', width: { xs: '80%', md: '80%', lg: '50%' }, textAlign: 'justify' }}>
      <Typography variant="h4" component="h2">
        Welcome to The Soroban Security Portal
      </Typography>
      <TextBlock>
        Your premier resource for everything related to securing projects on the <ExternalLink url="https://stellar.org/developers" text="Soroban smart contract platform"/>.
      </TextBlock>
      <H5 text="Mission" />
      <TextBlock>
        As Soroban's capabilities grow, so do the stakes. Deployed on Stellar's robust layer-1 blockchain, Soroban brings powerful smart contract functionality — but also attracts scrutiny in an inherently adversarial environment. The Soroban Security Portal is dedicated to supporting developers, auditors, and builders with clear, centralized guidance, tools, and insights to build securely from the ground up.
      </TextBlock>
      <H5 text="What you can find in the Portal" />
      <TextBlock>
        <ul>
          <li><InternalLink path="/reports" text="Audit reports"/>, detailed <InternalLink path="/vulnerabilities" text="vulnerability descriptions"/>, and many more soon;</li>
          {/* , security tools (soon), checklists (soon), and expert insights (soon) — forming your "safety compass" within the Soroban ecosystem;</li> */}
          <li>Up to date database, aligned with the <ExternalLink url="https://stellar.org/blog/developers/the-soroban-audit-bank-fostering-a-secure-smart-contract-ecosystem" text="Soroban Security Audit Bank"/> from the <ExternalLink url="https://stellar.org/foundation" text="Stellar Development Foundation"/>, the Portal connects you with structured audit insights, streamlined processes, and educational opportunities (soon). Whether you're launching a new DeFi protocol or enhancing an existing dApp, you'll find development and security guidance;</li>
          {/* <li>Soroban emphasizes testability, offering local testing, unit and integration tests, fuzzing, and static analysis via Rust tooling. We highlight (soon) STRIDE-based threat modeling, formal verification options, and tooling from trusted providers—helping teams catch vulnerabilities early and efficiently;</li>
          <li>From developer workshops to fireside chats featuring industry experts, we bring you the latest thinking on proactive security and evolving threats. You'll also find recommendations, checklists, and real-world audit analysis;</li>
          <li>To prevent scattered information from slowing you down, our community-powered knowledge base (soon) aggregates vulnerabilities, past audits, and best practices into a searchable, well-classified repository—complete with moderation and advanced integration capabilities.</li> */}
        </ul>
      </TextBlock>
      <H5 text="Why the Portal exists" />
      <TextBlock>
        <ul>
          <li><strong>Security is foundational:</strong> Soroban, built in Rust, offers strong safety features — but ecosystem-wide safety depends on builders being informed and proactive;</li>
          <li><strong>A proactive approach wins:</strong> Stellar's Audit Bank embeds security before launch — helping prevent hacks and build user trust. The Portal amplifies this mission with full visibility and education.</li>
          <li><strong>Learning from real mistakes:</strong> By spotlighting actual audits, common pitfalls, and expert insights, we help you avoid repeating others' errors — and encourage resilient, secure code.</li>
        </ul>
      </TextBlock>
      <H5 text="For whom" />
      <TextBlock>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
          <Box component="thead">
            <Box component="tr" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box component="th" sx={{ textAlign: 'left', p: 1 }}>Role</Box>
              <Box component="th" sx={{ textAlign: 'left', p: 1 }}>Why It Matters</Box>
            </Box>
          </Box>
          <Box component="tbody">
            <Box component="tr" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box component="td" sx={{ p: 1 }}>Developers & Builders</Box>
              <Box component="td" sx={{ p: 1 }}>Prepare for audits, understand toolchains, and implement best practices before going live.</Box>
            </Box>
            <Box component="tr" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box component="td" sx={{ p: 1 }}>Security Auditors & Researchers</Box>
              <Box component="td" sx={{ p: 1 }}>Access aggregated findings, audit reports, and share emerging vulnerabilities.</Box>
            </Box>
            <Box component="tr" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box component="td" sx={{ p: 1 }}>Teams Seeking Audits</Box>
              <Box component="td" sx={{ p: 1 }}>View what auditors reports look like and reach out to one you like and trust most.</Box>
            </Box>
            <Box component="tr">
              <Box component="td" sx={{ p: 1 }}>Curious Community Members</Box>
              <Box component="td" sx={{ p: 1 }}>Stay informed on ecosystem-wide security standards, tooling, and learning opportunities.</Box>
            </Box>
          </Box>
        </Box>
      </TextBlock>
      <H5 text="Our Gratitude"/>
      <Box component="img"
        sx={{ width: { xs: '80%', md: '50%' }, display: 'flex', justifyContent: 'left', my: 3 }}
        src="/static/images/sfc-lockup-svg-white.svg"
        alt="Stellar Community Fund"
      />
      <TextBlock>
        The development of the <ExternalLink url="https://communityfund.stellar.org/dashboard/projects/recy31Stl9XP0x7EA" text="Soroban Security Portal" /> was proudly supported by the{' '}
        <ExternalLink url="https://communityfund.stellar.org/" text="Stellar Community Fund" />.
      </TextBlock>
      <TextBlock>We are deeply grateful to the Stellar community for recognizing the importance of security in the Soroban ecosystem and for providing the resources to turn this vision into reality. This sponsorship not only helped us launch the portal but also reinforced the shared belief that secure smart contracts are the foundation of trust and adoption on Stellar.</TextBlock>
      <TextBlock>This support empowers us to continue building tools, knowledge bases, and educational resources that help developers, auditors, and the community at large create safer decentralized applications. Together with Stellar, we're shaping a secure and sustainable future for Soroban.</TextBlock>
    </Box>
  );
};
