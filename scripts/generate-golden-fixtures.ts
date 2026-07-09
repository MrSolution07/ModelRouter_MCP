#!/usr/bin/env tsx
/**
 * Generates the 30+ golden dataset fixtures per master plan §11.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const goldenDir = path.join(root, "data", "golden");

interface FixtureSpec {
  category: string;
  id: string;
  plan: string;
  taskType: string;
  complexityMin: number;
  complexityMax: number;
}

const FIXTURES: FixtureSpec[] = [
  // trivial_docs x4
  { category: "trivial_docs", id: "01", plan: "# Update README\n\nFix typo in installation section and update changelog.", taskType: "trivial_docs", complexityMin: 1, complexityMax: 3 },
  { category: "trivial_docs", id: "02", plan: "# Documentation\n\nAdd API documentation comments to the helper module.", taskType: "trivial_docs", complexityMin: 1, complexityMax: 3 },
  { category: "trivial_docs", id: "03", plan: "# Changelog\n\nDocument the 0.2.0 release notes.", taskType: "trivial_docs", complexityMin: 1, complexityMax: 2 },
  { category: "trivial_docs", id: "04", plan: "# Docs typo\n\nCorrect spelling in the user guide.", taskType: "trivial_docs", complexityMin: 1, complexityMax: 2 },
  // crud x4
  { category: "crud", id: "01", plan: "# CRUD API\n\nAdd REST endpoints for user management with create, list, update, delete.", taskType: "crud", complexityMin: 3, complexityMax: 6 },
  { category: "crud", id: "02", plan: "# API route\n\nImplement POST /api/items endpoint with validation.", taskType: "crud", complexityMin: 3, complexityMax: 6 },
  { category: "crud", id: "03", plan: "# Form view\n\nBuild a list view with create and update forms.", taskType: "crud", complexityMin: 3, complexityMax: 6 },
  { category: "crud", id: "04", plan: "# REST resource\n\nAdd CRUD operations for products resource.", taskType: "crud", complexityMin: 4, complexityMax: 7 },
  // multi_file_feature x4
  { category: "multi_file_feature", id: "01", plan: "# Feature: OAuth\n\nImplement OAuth integration across auth module, API routes, and frontend.", taskType: "multi_file_feature", complexityMin: 5, complexityMax: 8 },
  { category: "multi_file_feature", id: "02", plan: "# Add support for webhooks\n\nImplement webhook delivery across modules.", taskType: "multi_file_feature", complexityMin: 5, complexityMax: 8 },
  { category: "multi_file_feature", id: "03", plan: "# Integration feature\n\nAdd Stripe payment support across backend and frontend.", taskType: "multi_file_feature", complexityMin: 6, complexityMax: 9 },
  { category: "multi_file_feature", id: "04", plan: "# Multi-file implement\n\nImplement notification system across services.", taskType: "multi_file_feature", complexityMin: 5, complexityMax: 8 },
  // refactoring x4
  { category: "refactoring", id: "01", plan: "# Refactoring\n\nRefactor auth module. Extract utilities and rename handlers.", taskType: "refactoring", complexityMin: 4, complexityMax: 8 },
  { category: "refactoring", id: "02", plan: "# Restructure\n\nMigrate legacy API to new structure. Deduplicate shared code.", taskType: "refactoring", complexityMin: 5, complexityMax: 9 },
  { category: "refactoring", id: "03", plan: "# Cleanup\n\nExtract common validation logic into shared module.", taskType: "refactoring", complexityMin: 4, complexityMax: 7 },
  { category: "refactoring", id: "04", plan: "# Rename migration\n\nRename deprecated service classes across codebase.", taskType: "refactoring", complexityMin: 4, complexityMax: 8 },
  // architecture x4
  { category: "architecture", id: "01", plan: "# System design\n\nDesign microservice architecture for order processing with scalability.", taskType: "architecture", complexityMin: 7, complexityMax: 10 },
  { category: "architecture", id: "02", plan: "# Architecture proposal\n\nPropose distributed infrastructure for multi-region deployment.", taskType: "architecture", complexityMin: 7, complexityMax: 10 },
  { category: "architecture", id: "03", plan: "# Scalability plan\n\nDesign system for 10x traffic growth.", taskType: "architecture", complexityMin: 6, complexityMax: 9 },
  { category: "architecture", id: "04", plan: "# Infrastructure design\n\nPlan migration to event-driven microservices.", taskType: "architecture", complexityMin: 7, complexityMax: 10 },
  // security x4
  { category: "security", id: "01", plan: "# Security fix\n\nFix XSS vulnerability in auth form validation.", taskType: "security", complexityMin: 5, complexityMax: 8 },
  { category: "security", id: "02", plan: "# Auth hardening\n\nImprove authentication and authorization for admin routes.", taskType: "security", complexityMin: 5, complexityMax: 8 },
  { category: "security", id: "03", plan: "# CVE remediation\n\nPatch SQL injection vulnerability in search endpoint.", taskType: "security", complexityMin: 6, complexityMax: 9 },
  { category: "security", id: "04", plan: "# Security audit\n\nReview and fix authorization bypass in API.", taskType: "security", complexityMin: 5, complexityMax: 8 },
  // ambiguous x3
  { category: "ambiguous", id: "01", plan: "# Investigate\n\nDebug intermittent test failures. Figure out root cause.", taskType: "ambiguous", complexityMin: 4, complexityMax: 8 },
  { category: "ambiguous", id: "02", plan: "# Research\n\nExplore unknown performance regression in production.", taskType: "ambiguous", complexityMin: 5, complexityMax: 8 },
  { category: "ambiguous", id: "03", plan: "# Unknown bug\n\nInvestigate and fix mysterious data corruption issue.", taskType: "ambiguous", complexityMin: 5, complexityMax: 9 },
  // monorepo x3
  { category: "monorepo", id: "01", plan: "# Monorepo setup\n\nConfigure turborepo workspace for shared packages.", taskType: "monorepo", complexityMin: 5, complexityMax: 8 },
  { category: "monorepo", id: "02", plan: "# Workspace packages\n\nAdd new package to nx monorepo with shared dependencies.", taskType: "monorepo", complexityMin: 5, complexityMax: 8 },
  { category: "monorepo", id: "03", plan: "# Lerna migration\n\nMigrate multi-package repo to unified build pipeline.", taskType: "monorepo", complexityMin: 6, complexityMax: 9 },
];

for (const fx of FIXTURES) {
  const dir = path.join(goldenDir, fx.category, fx.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "plan.md"), fx.plan + "\n");
  writeFileSync(
    path.join(dir, "expected.json"),
    JSON.stringify(
      {
        taskType: fx.taskType,
        complexityRange: { min: fx.complexityMin, max: fx.complexityMax },
        notes: `Golden fixture ${fx.category}/${fx.id}`,
      },
      null,
      2,
    ) + "\n",
  );
}

console.log(`Generated ${FIXTURES.length} golden fixtures.`);
