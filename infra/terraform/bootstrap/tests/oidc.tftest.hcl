mock_provider "aws" {
  mock_data "aws_iam_policy_document" {
    defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }
}

variables {
  state_bucket_name = "ticketrush-oidc-contract-test"
  github_org        = "review-owner"
  github_repo       = "review-repo"
}

run "workflow_environment_subjects" {
  command = plan

  assert {
    condition = toset(local.github_subjects) == toset([
      "repo:review-owner/review-repo:ref:refs/heads/main",
      "repo:review-owner/review-repo:environment:demo",
      "repo:review-owner/review-repo:environment:prod",
    ])
    error_message = "Trust must include exactly the branch and both deployment environments."
  }
}

run "immutable_repository_subjects" {
  command = plan
  variables {
    github_subject_repository = "review-owner@123/review-repo@456"
    github_environments       = ["demo"]
  }
  assert {
    condition = toset(local.github_subjects) == toset([
      "repo:review-owner@123/review-repo@456:ref:refs/heads/main",
      "repo:review-owner@123/review-repo@456:environment:demo",
    ])
    error_message = "Immutable subjects must preserve both IDs and restrict the environment set."
  }
}

run "environment_colons_are_encoded" {
  command = plan
  variables {
    github_environments = ["production:eastus"]
  }
  assert {
    condition     = contains(local.github_subjects, "repo:review-owner/review-repo:environment:production%3Aeastus") && length(local.github_subjects) == 2
    error_message = "Environment names must follow GitHub's subject encoding."
  }
}
