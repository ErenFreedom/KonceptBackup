import React from "react";
import "./SubsiteActiveSensor.css";

const SubsiteActiveSensor = ({ selectedSite }) => {
  return (
    <div className="subsite-active-sensor">
      <h2>Hi, this is Sub-site Active Sensors: {selectedSite?.name || "Unknown"}</h2>
    </div>
  );
};

export default SubsiteActiveSensor;