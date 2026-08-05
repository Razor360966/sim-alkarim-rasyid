import React from "react";
import { ExecutiveMutabaahDrilldown } from "../components/ExecutiveMutabaahDrilldown";
import { useSearchParams } from "react-router-dom";

export const ExecutiveMutabaahGuruPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialStatusFilter = searchParams.get("status") || "ALL";

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <ExecutiveMutabaahDrilldown initialStatusFilter={initialStatusFilter} />
    </div>
  );
};

export default ExecutiveMutabaahGuruPage;
