import { promises as fs } from 'node:fs'
import path from 'node:path'
import { cleanupSVG, importDirectory, isEmptyColor, parseColors, runSVGO } from '@iconify/tools'
import { Plugin, normalizePath } from 'vite'

interface IconifyPluginOptions {
  sourceSVGDir?: string
  target?: string
  prefix?: string
}

interface IconifyInfo {
  name: string
  author: {
    name: string
    url: string
  }
  license: {
    title: string
    url: string
    spdx: string
  }
  height: number
  samples: string[]
}

export default function iconifyPlugin(options: IconifyPluginOptions = {}): Plugin {
  const {
    sourceSVGDir = 'src/assets/icons/svg', // 默认路径修改为相对路径
    target = 'iconify.json', // 默认导出位置为项目根目录
    prefix = 'custom',
  } = options

  let rootDir: string

  async function generateIconJSON() {
    const sourceDir = path.resolve(rootDir, sourceSVGDir)
    const targetPath = path.resolve(rootDir, target)

    try {
      // 检查源目录是否存在，不存在则创建
      await fs.mkdir(sourceDir, { recursive: true })

      // 从目录导入图标
      const iconSet = await importDirectory(sourceDir, {
        prefix,
        filenameToIcon: (filename, filePath) => {
          // 计算相对路径
          const relativePath = path.relative(sourceDir, filePath)
          // 去掉文件扩展名
          const nameWithoutExt = relativePath.slice(0, -path.extname(relativePath).length)
          // 将路径中的目录分隔符替换为'-'
          return nameWithoutExt.split(path.sep).join('-')
        },
      })

      // 设置图标集信息
      const info: IconifyInfo = {
        name: 'Custom Icon Set',
        author: {
          name: 'Your Name',
          url: 'https://yourwebsite.com',
        },
        license: {
          title: 'Custom License',
          url: 'https://yourwebsite.com/license',
          spdx: '',
        },
        height: 24,
        samples: [],
      }
      iconSet.info = info

      // 清理和优化图标
      await iconSet.forEach(async (name, type) => {
        if (type !== 'icon') {
          return
        }

        // 获取SVG实例
        const svg = iconSet.toSVG(name)
        if (!svg) {
          // 无效图标，移除
          iconSet.remove(name)
          return
        }

        // 清理和优化SVG
        try {
          cleanupSVG(svg)

          // 将颜色替换为currentColor
          parseColors(svg, {
            defaultColor: 'currentColor',
            callback: (attr, colorStr, color) => {
              return !color || isEmptyColor(color) ? colorStr : 'currentColor'
            },
          })

          // 运行SVGO优化
          await runSVGO(svg)
        } catch (err) {
          console.error(`Error parsing ${name}:`, err)
          iconSet.remove(name)
          return
        }

        // 更新图标
        iconSet.fromSVG(name, svg)
      })

      // 导出为Iconify JSON
      const output = JSON.stringify(iconSet.export(), null, '\t')

      // 创建输出目录
      const dir = path.dirname(targetPath)
      await fs.mkdir(dir, { recursive: true })

      // 保存到文件
      await fs.writeFile(targetPath, output, 'utf8')
      console.log(`Saved ${targetPath} (${output.length} bytes)`)
    } catch (err) {
      console.error(`Error accessing or creating source directory: ${sourceDir}`)
      console.error(err)
    }
  }

  return {
    name: 'vite-plugin-iconify-generator',
    configResolved(config) {
      rootDir = config.root
    },
    buildStart() {
      generateIconJSON()
    },
    configureServer(server) {
      const watcher = server.watcher
      const sourceDir = path.resolve(rootDir, sourceSVGDir)

      watcher.add(normalizePath(sourceDir))
      watcher.on('add', (file) => {
        if (file.startsWith(sourceDir)) {
          generateIconJSON()
        }
      })
      watcher.on('change', (file) => {
        if (file.startsWith(sourceDir)) {
          generateIconJSON()
        }
      })
      watcher.on('unlink', (file) => {
        if (file.startsWith(sourceDir)) {
          generateIconJSON()
        }
      })
    },
  }
}
