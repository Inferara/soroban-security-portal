import { Box, Typography } from "@mui/material";
import { FC, MouseEvent, ReactNode } from "react";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import BugReportRoundedIcon from "@mui/icons-material/BugReportRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import { AnimatedSuperscriptCounter } from "./statistics-counter";
import { useVulnerabilityStatistics } from "./hooks";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useReducedMotion } from "../../../../hooks/useReducedMotion";

export type StatisticsChangeProps = Record<string, never>;

interface StatCardProps {
  icon: ReactNode;
  total: number;
  delta: number;
  label: string;
  accent: string;
}

const StatCard: FC<StatCardProps> = ({ icon, total, delta, label, accent }) => {
  const { tokens } = useTheme();
  const reduced = useReducedMotion();

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <Box
      onMouseMove={handleMove}
      sx={{
        position: "relative",
        overflow: "hidden",
        p: { xs: 3, md: 3.5 },
        borderRadius: 4,
        backgroundColor: tokens.surface,
        border: "1px solid",
        borderColor: tokens.surfaceBorder,
        boxShadow: tokens.surfaceShadow,
        backdropFilter: "blur(8px)",
        transition: "transform .25s ease, box-shadow .25s ease, border-color .25s ease",
        // cursor-following spotlight
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background: `radial-gradient(220px circle at var(--mx, 50%) var(--my, 0%), ${accent}22, transparent 60%)`,
          opacity: 0,
          transition: "opacity .25s ease",
          pointerEvents: "none",
        },
        "&:hover": {
          transform: reduced ? "none" : "translateY(-4px)",
          boxShadow: tokens.surfaceShadowHover,
          borderColor: accent,
        },
        "&:hover::before": { opacity: 1 },
      }}
    >
      {/* top accent line */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          opacity: 0.8,
        }}
      />
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 1.5,
          color: accent,
          backgroundColor: `${accent}1f`,
          border: `1px solid ${accent}55`,
        }}
      >
        {icon}
      </Box>

      {/* delta pill (own line — never overlaps the number) */}
      <Box sx={{ minHeight: 24, mb: 0.5 }}>
        {delta > 0 && (
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.4,
              px: 1,
              py: 0.25,
              borderRadius: 999,
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#7CCF8E",
              backgroundColor: "rgba(86,158,103,0.16)",
              border: "1px solid rgba(86,158,103,0.3)",
            }}
          >
            <ArrowUpwardRoundedIcon sx={{ fontSize: 13 }} /> +{delta} this month
          </Box>
        )}
      </Box>

      <Box
        sx={{
          "& .MuiBadge-root": { display: "block" },
          "& .MuiTypography-h1": {
            fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
            fontWeight: 800,
            lineHeight: 1,
            backgroundImage: tokens.goldGradient,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          },
        }}
      >
        <AnimatedSuperscriptCounter duration={1200} targetRaw={total} supRaw={0} />
      </Box>

      <Typography
        variant="subtitle1"
        sx={{ mt: 1, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: "text.secondary" }}
      >
        {label}
      </Typography>
    </Box>
  );
};

export const StatisticsChanges: FC<StatisticsChangeProps> = () => {
  const {
    vulnerabilitiesStatisticsChange,
    reportsStatisticsChange,
    protocolsStatisticsChange,
    auditorsStatisticsChange,
  } = useVulnerabilityStatistics();
  const { tokens } = useTheme();

  const items: StatCardProps[] = [
    {
      icon: <BugReportRoundedIcon />,
      total: vulnerabilitiesStatisticsChange?.total ?? 0,
      delta: vulnerabilitiesStatisticsChange?.new ?? 0,
      label: "Vulnerabilities",
      accent: tokens.accentBlue,
    },
    {
      icon: <DescriptionRoundedIcon />,
      total: reportsStatisticsChange?.total ?? 0,
      delta: reportsStatisticsChange?.new ?? 0,
      label: "Reports",
      accent: tokens.accentGold,
    },
    {
      icon: <HubRoundedIcon />,
      total: protocolsStatisticsChange?.total ?? 0,
      delta: protocolsStatisticsChange?.new ?? 0,
      label: "Protocols",
      accent: "#7C4DFF",
    },
    {
      icon: <VerifiedUserRoundedIcon />,
      total: auditorsStatisticsChange?.total ?? 0,
      delta: auditorsStatisticsChange?.new ?? 0,
      label: "Auditors",
      accent: "#22C7C7",
    },
  ];

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, md: 3 } }}>
      <Typography
        variant="overline"
        sx={{ display: "block", textAlign: "center", color: "text.secondary", letterSpacing: "0.2em", mb: 1 }}
      >
        By the numbers
      </Typography>
      <Typography
        variant="h3"
        sx={{ textAlign: "center", fontWeight: 800, mb: { xs: 4, md: 6 }, color: "text.primary" }}
      >
        The Soroban security landscape
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
        }}
      >
        {items.map((it) => (
          <StatCard key={it.label} {...it} />
        ))}
      </Box>
    </Box>
  );
};
