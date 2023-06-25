import { Elysia, t } from "elysia"
import { PrismaClient } from '@prisma/client'
import { jwt } from '@elysiajs/jwt'
import { queryRoute } from "./queries"
import { mutationRoute } from "./mutations"
import { sendEmail } from "./mail"

const client = new PrismaClient()

export const setdb = (app: Elysia) => app.decorate("db", client)

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET ?? '123',
      exp: '30d'
    })
  )
  .use(setdb)
  .group('/login', app => app
    // .post('/', async ({jwt}) => jwt.sign({id: '1011'}))
    .post('/token',
      async ({jwt, body}) => {
        const payload = await jwt.verify(body.token)
        if (!payload) throw Error('Unauthorized')
        const { id } = payload
        const token = await jwt.sign({id})
        return { token, id }
      },
      {
        body: t.Object({
          token: t.String()
        })
      }
    )
    .post('/password',
      async ({ jwt, body: { email, password, pushToken }, db }) => {
        const user = await db.user.update({
          where: { email },
          data: { token: pushToken ?? '' }
        })
        const isCorrectPassword = await Bun.password.verify(password, user?.password!)
        if (!user || !isCorrectPassword) {
          throw Error(user ? 'Wrong password' : 'No such user')
        }
        const id = user.id
        const token = jwt.sign({ id })
        return { token, id }
      },
      {
        body: t.Object({
          email: t.String(),
          password: t.String(),
          pushToken: t.String(),
        })
      }
    )
    .post('/register',
      async ({body: { email, password, pushToken }, db, jwt }) => {
        if (!email || !password) {
          throw Error('Bad request data')
        }
        const userCount = await db.user.count({ where: { email } })
        if (userCount > 0) {
          throw Error('User already exists')
        }
        const hash = await Bun.password.hash(password)
        const user = await db.user.create({
          data: {
            email,
            token: pushToken ?? '',
            password: hash
          },
        })
        const id = user.id
        const token = jwt.sign({ id })
        return { token, id }
      },
      {
        body: t.Object({
          email: t.String(),
          password: t.String(),
          pushToken: t.String(),
        })
      }
    )
    .post('/restore',
      async ({ body: { email }, db }) => {
        const str = (Math.random() + 1).toString(36).substring(7)
        const password = await Bun.password.hash(str)
        const updatedUser = await db.user.update({
          where: { email },
          data: { password }
        })
        if (!updatedUser) {
          throw Error('User does not exist')
        }
        sendEmail(email, {name: updatedUser?.name!, password })
        return { message: 'Check email' }
      },
      {
        body: t.Object({
          email: t.String()
        })
      }
    )
  )
  .derive(async ({ request: { headers }, jwt }) => {
    const auth = headers.get('Authorization') ?? undefined
    const payload = await jwt.verify(auth)
    if (!payload) throw Error('Unauthorized')
    return { id: payload.id }
  })
  .use(queryRoute)
  .use(mutationRoute)
  .group(
    '/password', {
      body: t.Object({
        password: t.String()
      })
    }, 
    app => app
      .derive(async ({ body: { password }, id, db }) => {
        const user = await db.user.findUnique({ where: { id }, select: { password: true} })
        const isCorrectPassword = await Bun.password.verify(password, user?.password!)
        if (!isCorrectPassword) throw Error('Unauthorized')
      })
      .post('/reset',
        async ({body: { newPassword }, db, id}) => {
          const password = await Bun.password.hash(newPassword)
          await db.user.update({
            where: { id },
            data: { password }
          })
          return { success: true }
        },
        {
          body: t.Object({
            newPassword: t.String()
          })
        }
      )
      .post('/user/delete',
        async ({db, id}) => {
          await db.user.delete({ where: { id } })
          return { success: true }
        }
      )
  )
  .listen(3000);

export type App = typeof app

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);