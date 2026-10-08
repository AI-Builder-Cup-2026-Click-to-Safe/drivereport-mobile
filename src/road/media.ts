import fixtures from "./submission-fixtures.json";
import { normalizePlate, type RoadCase } from "./model";

const frames: Record<string, number> = {
  WXY2048: require("../../assets/road/images/frame-wxy2048.jpg"),
  VBN7712: require("../../assets/road/images/frame-vbn7712.jpg"),
  JSA401: require("../../assets/road/images/frame-jsa401.jpg"),
  BQQ993: require("../../assets/road/images/frame-bqq993.jpg"),
};
export function demoFrameFor(c: RoadCase) {
  // An edited plate must never switch the underlying evidence image.
  const plate =
    c.analysis?.vehicle.plate ??
    fixtures.allCases.find((f) => f.id === c.id)?.vehicle.plate;
  return (
    frames[normalizePlate(plate || null)] ||
    require("../../assets/road/images/dashcam-evidence-demo.jpg")
  );
}
