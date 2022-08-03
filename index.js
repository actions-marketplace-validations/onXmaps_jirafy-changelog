const core = require('@actions/core')
const exec = require('@actions/exec')
const github = require('@actions/github')
const { jirafyChangelog } = require('./utils/changelog')

const src = __dirname

async function run() {
  try {
    var headRef = core.getInput('head-ref')
    var baseRef = core.getInput('base-ref')
    const myToken = core.getInput('myToken')
    const octokit = new github.getOctokit(myToken)
    const { owner, repo } = github.context.repo
    const regexp = /^[.A-Za-z0-9_-]*$/

    if (!headRef) {
      headRef = github.context.sha
    }

    if (!baseRef) {
      const latestRelease = await octokit.rest.repos.getLatestRelease({
        owner: owner,
        repo: repo,
      })
      if (latestRelease) {
        baseRef = latestRelease.data.tag_name
      } else {
        core.setFailed(
          `There are no releases on ${owner}/${repo}. Tags are not releases.`,
        )
      }
    }

    console.log(`head-ref: ${headRef}`)
    console.log(`base-ref: ${baseRef}`)

    if (
      !!headRef &&
      !!baseRef &&
      regexp.test(headRef) &&
      regexp.test(baseRef)
    ) {
      const resp = await generateReleaseNotes(owner, repo, baseRef, headRef)
      jirafyReleaseNotes(resp.body)
      //getChangelog(headRef, baseRef, owner + '/' + repo)
    } else {
      core.setFailed(
        'Branch names must contain only numbers, strings, underscores, periods, and dashes.',
      )
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function generateReleaseNotes(owner, repo, previousTag, tag) {
  return await octokit.request(`POST /repos/${owner}/${repo}/releases/generate-notes`, {
    owner: owner,//'OWNER',
    repo: repo, //'REPO',
    tag_name: 'v1.3.0', //'v1.0.0',
    target_commitish: 'main',
    previous_tag_name: 'v1.2.0' //'v0.9.2',
  })
}

function jirafyReleaseNotes(changelog) {
  core.setOutput('changelog', jirafyChangelog(changelog))
}

async function getChangelog(headRef, baseRef, repoName) {
  try {
    let output = ''
    let err = ''

    // These are option configurations for the @actions/exec lib`
    const options = {}
    options.listeners = {
      stdout: (data) => {
        output += data.toString()
      },
      stderr: (data) => {
        err += data.toString()
      },
    }
    options.cwd = './'

    await exec.exec(
      `${src}/changelog.sh`,
      [headRef, baseRef, repoName],
      options,
    )

    if (output) {
      output = jirafyChangelog(output)
      console.log(
        '\x1b[32m%s\x1b[0m',
        `Changelog between ${baseRef} and ${headRef}:\n${output}`,
      )
      core.setOutput('changelog', output)
    } else {
      core.setFailed(err)
      process.exit(1)
    }
  } catch (err) {
    core.setFailed(
      `Could not generate changelog between references because: ${err.message}`,
    )
    process.exit(0)
  }
}

try {
  run()
} catch (error) {
  core.setFailed(error.message)
}
