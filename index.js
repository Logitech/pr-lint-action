const { Toolkit } = require('actions-toolkit')
const getConfig = require('./utils/config')

const CONFIG_FILENAME = 'jira_config.yml'

const defaults = {
  tickets: ['VC'],
  check_title: true,
  check_branch: false,
  check_commits: false,
  ignore_case: true
}

Toolkit.run(
  async tools => {
    const { repository, pull_request } = tools.context.payload

    const repoInfo = {
      owner: repository.owner.login,
      repo: repository.name,
      ref: pull_request.head.ref
    }

    const config = {
      ...defaults,
      ...(await getConfig(tools.github, CONFIG_FILENAME, repoInfo))
    }

    const title = config.ignore_case ?
      pull_request.title.toLowerCase() :
      pull_request.title

    const head_branch = config.ignore_case ?
      pull_request.head.ref.toLowerCase() :
      pull_request.head.ref

    const tickets = config.tickets.map(project => config.ignore_case ? project.toLowerCase() : project)
    const title_passed = (() => {
      if (config.check_title) {
        // check the title matches [VC-1234] somewhere
        if (!tickets.some(project => title.match(createWrappedProjectRegex(project)))) {
          tools.log('PR title ' + title + ' does not contain approved Jiras')
          return false
        }
      }
      return true
    })()

    const branch_passed = (() => {
      // check the branch matches VC-1234 or VC_1234 somewhere
      if (config.check_branch) {
        if (!tickets.some(project => head_branch.match(createProjectRegex(project)))) {
          tools.log('PR branch ' + head_branch + ' does not contain an approved Jiras')
          return false
        }
      }
      return true
    })()

    const commits_passed = await (async () => {
      // check the branch matches VC-1234 or VC_1234 somewhere
      if (config.check_commits) {
        const listCommitsParams = {
          owner: repository.owner.login,
          repo: repository.name,
          pull_number: pull_request.number
        }
        const commitsInPR = (await tools.github.pulls.listCommits(listCommitsParams)).data
        const failedCommits = findFailedCommits(tickets, commitsInPR, config.ignore_case);

        if(failedCommits.length) {
          failedCommits.forEach(
            failedCommit => tools.log('Commit message \'' + failedCommit + '\' does not contain an approved Jiras')
          )
          return false
        }
      }
      return true
    })()

    const statuses = [title_passed, branch_passed, commits_passed]

    await tools.github.checks.listForRef(Object.assign({'status': 'completed'}, repoInfo))
      .check_runs
      .filter(check_run => {check_run.name === "pr_lint"})
      .forEach(check_run => {
        tools.github.checks.update({
          owner: repository.owner.login,
          repo: repository.name,
          check_run_id: check_run.id,
          conclusion: 'cancelled',
        })
      })

    if (statuses.some(status => status === false )){
      tools.exit.failure("PR Linting Failed")
    } else {
      tools.exit.success()
    }
  },
  { event: ['pull_request.opened', 'pull_request.edited', 'pull_request.synchronize'], secrets: ['GITHUB_TOKEN'] }
)

function findFailedCommits(tickets, commitsInPR, ignoreCase) {
  const failedCommits = [];
  tickets.forEach(project => {
    commitsInPR.forEach(commit => {
      const commitMessage = ignoreCase ? commit.commit.message.toLowerCase() : commit.commit.message
      if (!commitMessage.match(createProjectRegex(project))) {
        failedCommits.push(commitMessage);
      }
    });
  });
  return failedCommits;
}

function createProjectRegex(project) {
  return new RegExp(project + '[-_]\\d*')
}

function createWrappedProjectRegex(project) {
  return new RegExp('\\[' + project + '-\\d*\\]')
}
