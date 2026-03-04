import type { SkillListing, PackageListing } from "./types";

export const MOCK_SKILLS: SkillListing[] = [
  {
    id: "0xmock_skill_1",
    seller: "0xaa00bb11cc22dd33ee44ff5566778899aabbccdd",
    title: "Advanced Code Review Agent",
    description:
      "A comprehensive AI agent that performs deep code reviews, identifies security vulnerabilities, suggests performance optimizations, and enforces coding standards across multiple languages.",
    price: 5_000_000_000n, // 5 SUI
    category: "Development",
    tags: ["code-review", "security", "agent"],
    walrusBlobId: "mock_blob_1",
    walrusQuiltId: null,
    sealKeyId: "mock_key_1",
    createdAtEpoch: 100,
    isActive: true,
  },
  {
    id: "0xmock_skill_2",
    seller: "0xbb11cc22dd33ee44ff5566778899aabbccddeeff",
    title: "Data Analysis Pipeline Prompt",
    description:
      "A structured prompt chain that transforms raw data into actionable insights. Handles CSV, JSON, and SQL outputs with automatic visualization suggestions.",
    price: 2_000_000_000n, // 2 SUI
    category: "Data Science",
    tags: ["data", "analytics", "prompt"],
    walrusBlobId: "mock_blob_2",
    walrusQuiltId: null,
    sealKeyId: "mock_key_2",
    createdAtEpoch: 101,
    isActive: true,
  },
  {
    id: "0xmock_skill_3",
    seller: "0xaa00bb11cc22dd33ee44ff5566778899aabbccdd",
    title: "Content Strategy Generator",
    description:
      "AI tool configuration for generating content calendars, blog outlines, social media posts, and SEO-optimized articles from a single topic input.",
    price: 3_000_000_000n, // 3 SUI
    category: "Marketing",
    tags: ["content", "seo", "marketing"],
    walrusBlobId: "mock_blob_3",
    walrusQuiltId: null,
    sealKeyId: "mock_key_3",
    createdAtEpoch: 102,
    isActive: true,
  },
  {
    id: "0xmock_skill_4",
    seller: "0xcc22dd33ee44ff5566778899aabbccddeeff0011",
    title: "Smart Contract Auditor",
    description:
      "Specialized agent for auditing Move and Solidity smart contracts. Detects reentrancy, overflow, access control issues, and provides fix suggestions.",
    price: 10_000_000_000n, // 10 SUI
    category: "Security",
    tags: ["audit", "smart-contract", "security", "agent"],
    walrusBlobId: "mock_blob_4",
    walrusQuiltId: "mock_quilt_1",
    sealKeyId: "mock_key_4",
    createdAtEpoch: 103,
    isActive: true,
  },
];

export const MOCK_PACKAGES: PackageListing[] = [
  {
    id: "0xmock_package_1",
    seller: "0xaa00bb11cc22dd33ee44ff5566778899aabbccdd",
    title: "Developer Toolkit Bundle",
    description:
      "Get the Code Review Agent and Smart Contract Auditor together at a 20% discount. Everything you need for secure development.",
    skillIds: ["0xmock_skill_1", "0xmock_skill_4"],
    discountBps: 2000, // 20%
    price: 12_000_000_000n, // 12 SUI (15 - 20%)
    createdAtEpoch: 104,
    isActive: true,
  },
];

export const MOCK_CATEGORIES = [
  "Development",
  "Data Science",
  "Marketing",
  "Security",
  "Writing",
  "Design",
];
