import { spawn } from 'child_process'
import { access, mkdir, readFile } from 'fs/promises'
import { constants } from 'fs'
import { basename, extname, join } from 'path'

export interface ImportCpdFileArgs {
  cpdPath: string
  extractorDir: string
  tempDir: string
}

export interface ImportCpdFileResult {
  jsonPath: string
  content: string
}

interface ExtractorCommand {
  command: string
  args: string[]
  cwd: string
  displayName: string
}

const MAX_CAPTURED_OUTPUT_LENGTH = 4000

function createOutputJsonPath(cpdPath: string, tempDir: string): string {
  const sourceName = basename(cpdPath, extname(cpdPath)).replace(/[^a-z0-9._-]+/gi, '_')
  return join(tempDir, `${sourceName || 'import'}-${Date.now()}.json`)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function getExitCodeMessage(code: number | null): string {
  if (code === 0) return 'CPD import completed.'
  if (code === null) return 'CPD extractor stopped before returning an exit code.'

  return `CPD extractor failed with exit code ${code}.`
}

function trimOutput(output: string): string {
  const trimmed = output.trim()
  if (trimmed.length <= MAX_CAPTURED_OUTPUT_LENGTH) return trimmed
  return `${trimmed.slice(0, MAX_CAPTURED_OUTPUT_LENGTH)}...`
}

function quoteForCmd(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

async function buildExtractorCommand(
  extractorDir: string,
  cpdPath: string,
  jsonPath: string
): Promise<ExtractorCommand> {
  const cmdPath = join(extractorDir, 'CpdExtractor.cmd')
  if (await pathExists(cmdPath)) {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: [
        '/d',
        '/s',
        '/c',
        `call ${quoteForCmd(cmdPath)} ${quoteForCmd(cpdPath)} ${quoteForCmd(jsonPath)}`
      ],
      cwd: extractorDir,
      displayName: 'CpdExtractor.cmd'
    }
  }

  const ps1Path = join(extractorDir, 'CpdExtractor.ps1')
  if (await pathExists(ps1Path)) {
    return {
      command: 'powershell.exe',
      args: [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        ps1Path,
        '-InputCpd',
        cpdPath,
        '-OutputJson',
        jsonPath
      ],
      cwd: extractorDir,
      displayName: 'CpdExtractor.ps1'
    }
  }

  throw new Error(
    `CPD extractor was not found in ${extractorDir}. Expected CpdExtractor.cmd or CpdExtractor.ps1.`
  )
}

async function runExtractor(command: ExtractorCommand): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd: command.cwd,
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', (error) => {
      reject(new Error(`Unable to start ${command.displayName}: ${error.message}`))
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      const output = trimOutput([stderr, stdout].filter(Boolean).join('\n'))
      const suffix = output ? `\n\nExtractor output:\n${output}` : ''
      reject(new Error(`${getExitCodeMessage(code)}${suffix}`))
    })
  })
}

export async function importCpdFile(args: ImportCpdFileArgs): Promise<ImportCpdFileResult> {
  try {
    await access(args.cpdPath, constants.R_OK)
  } catch {
    throw new Error(`CPD file could not be read: ${args.cpdPath}`)
  }

  await mkdir(args.tempDir, { recursive: true })

  const jsonPath = createOutputJsonPath(args.cpdPath, args.tempDir)
  const command = await buildExtractorCommand(args.extractorDir, args.cpdPath, jsonPath)

  await runExtractor(command)

  try {
    const content = await readFile(jsonPath, 'utf8')
    return { jsonPath, content }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`CPD extractor finished but the JSON output could not be read: ${message}`)
  }
}
