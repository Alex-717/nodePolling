const koa = require('koa')
const app = new koa()
const port = 3000
const staticServer = require('koa-static')
const path = require('path')
const bodyParser = require('koa-bodyparser')
const Router = require('koa-router')
const { v4: uuidv4 } = require('uuid');

const tasks = new Map() // 任务存储
const taskStatus = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAIL: 'fail'
}
const taskResultMap = {
  'pending': 1,
  'success': 2,
  'fail': 3
}

app.use(bodyParser())
// 重新配置静态文件服务器路径
app.use(staticServer(path.resolve(__dirname, 'public')))

const router = new Router()
/**
 * 处理任务提交的POST请求
 */
router.post('/api/task', async (ctx) => {
  console.log(ctx.request.body)
  const taskId = uuidv4()
  
  tasks.set(taskId, {
    taskId,
    status: taskStatus.PENDING,
    createTime: Date.now()
  })

  callThirdPartyApi(taskId).catch(err => {
    console.log('callThirdPartyApi err:', err)
  })

  ctx.body = getResponse(0, '任务提交成功', { taskId })
})

router.get('/api/task/:taskId', async (ctx) => {
  const taskId = ctx.params.taskId
  console.log('获取任务', taskId)
  if (!tasks.has(taskId)) {
    ctx.body = getResponse(-1, '任务不存在')
    return
  }
  const task = tasks.get(taskId)

  if (task.status === taskStatus.SUCCESS) {
    ctx.body = getResponse(0, '任务处理成功', {
      status: taskResultMap[task.status],
      result: task.result
    })
  } else if (task.status === taskStatus.FAIL) {
    ctx.body = getResponse(0, '任务处理失败', {
      status: taskResultMap[task.status],
      result: task.result
    })
  } else {
    ctx.body = getResponse(0, '任务处理中', {
      status: taskResultMap[task.status]
    })
  }
  
})

app.use(router.routes())
app.use(router.allowedMethods())
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`)
})

process.on('SIGINT', () => {
  console.log('服务器关闭中...')
  process.exit(0)
})

function getResponse (ret, msg, data = {}) {
  return {
    ret,
    msg,
    data
  }
}

async function callThirdPartyApi(taskId) {
  if (!tasks.has(taskId)) {
    return Promise.reject(new Error('任务不存在'))
  }

  const timeout = 6 * 1000
  await new Promise(resolve => setTimeout(resolve, timeout))

  const task = tasks.get(taskId)
  // 调用成功
  if (Math.random() > 0.5) {
    tasks.set(taskId, {
      ...task,
      status: taskStatus.SUCCESS,
      successTime: Date.now(),
      result: {
        msg: '任务处理成功'
      }
    })
    return
  }

  // 调用失败
  tasks.set(taskId, {
    ...task,
    status: taskStatus.FAIL,
    failTime: Date.now(),
    result: {
      msg: '任务处理失败'
    }
  })
}

/**
 * 清理过期任务记录
 * 删除创建时间超过30分钟的任务
 */
function cleanExpiredTasks() {
  const now = Date.now()
  const expireTime = 30 * 60 * 1000 // 30分钟
  let cleanedCount = 0
  
  for (const [taskId, task] of tasks.entries()) {
    if (now - task.createTime > expireTime) {
      tasks.delete(taskId)
      cleanedCount++
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`清理了 ${cleanedCount} 个过期任务，当前任务数量: ${tasks.size}`)
  }
}

/**
 * 启动定时清理任务
 * 每30分钟执行一次清理
 */
function startCleanupTimer() {
  const interval = 30 * 60 * 1000 // 30分钟
  setInterval(cleanExpiredTasks, interval)
  console.log('定时清理任务已启动，每30分钟执行一次')
}

// 启动定时清理
startCleanupTimer()