import { Bot } from "grammy";
import dotenv from "dotenv";
import { readConfig, requireStartupConfig } from "../config";
dotenv.config();

export const bot = new Bot(requireStartupConfig(readConfig()).telegram.token);
