import { Grid, Typography } from "@mui/material";
import { FC } from "react";
import { AnimatedSuperscriptCounter } from "./statistics-counter";
import { useVulnerabilityStatistics } from "./hooks";

export type StatisticsChangeProps = Record<string, never>;

export const StatisticsChanges: FC<StatisticsChangeProps> = () => {
  const {
    vulnerabilitiesStatisticsChange,
    reportsStatisticsChange,
    protocolsStatisticsChange,
    auditorsStatisticsChange
  } = useVulnerabilityStatistics();

  return (
    <Grid
      container
      spacing={{ xs: 5, md: 15 }}
      alignItems="center"
    >
      <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: { xs: "center", md: "right" } }}>
        <AnimatedSuperscriptCounter
          duration={1000}
          superDuration={800}
          decimals={0}
          superDecimals={0}
          targetRaw={vulnerabilitiesStatisticsChange?.total ?? 0}
          supRaw={vulnerabilitiesStatisticsChange?.new ?? 0}
        />
        <Typography variant="h4" sx={{ color: "text.primary", textTransform: "uppercase", mt: 1 }}>
          Vulnerabilities
        </Typography>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: { xs: "center", md: "left" } }}>
        <AnimatedSuperscriptCounter
          duration={1000}
          superDuration={800}
          decimals={0}
          superDecimals={0}
          targetRaw={reportsStatisticsChange?.total ?? 0}
          supRaw={reportsStatisticsChange?.new ?? 0}
        />
        <Typography variant="h4" sx={{ color: "text.primary", textTransform: "uppercase", mt: 1 }}>
          Reports
        </Typography>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: { xs: "center", md: "right" } }}>
        <AnimatedSuperscriptCounter
          duration={1000}
          superDuration={800}
          decimals={0}
          superDecimals={0}
          targetRaw={protocolsStatisticsChange?.total ?? 0}
          supRaw={protocolsStatisticsChange?.new ?? 0}
        />
        <Typography variant="h4" sx={{ color: "text.primary", textTransform: "uppercase", mt: 1 }}>
          Protocols
        </Typography>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: { xs: "center", md: "left" } }}>
        <AnimatedSuperscriptCounter
          duration={1000}
          superDuration={800}
          decimals={0}
          superDecimals={0}
          targetRaw={auditorsStatisticsChange?.total ?? 0}
          supRaw={auditorsStatisticsChange?.new ?? 0}
        />
        <Typography variant="h4" sx={{ color: "text.primary", textTransform: "uppercase", mt: 1 }}>
          Auditors
        </Typography>
      </Grid>
    </Grid>
  );
};
