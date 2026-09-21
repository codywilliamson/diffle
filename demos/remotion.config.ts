import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// the captures are png with no alpha; h264 is the right default for the mp4.
Config.setCodec("h264");
