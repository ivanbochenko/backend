import { Elysia, t } from "elysia"
import { auth, dbClient } from "."

export const passwordRoute = new Elysia({ prefix: '/password' })
  .decorate("db", dbClient)
  .use(auth)
  .post('/reset',
    async ({body: { password, newPassword }, db, id}) => {
      const hash = (await db.user.findUnique({ where: { id }, select: { password: true} }))?.password
      if (!hash) throw Error('No such user')
      const isCorrectPassword = await Bun.password.verify(password, hash)
      if (!isCorrectPassword) throw Error('Unauthorized')
      const newHash = await Bun.password.hash(newPassword)

      return await db.user.update({
        where: { id },
        data: { password: newHash }
      })
    },
    {
      body: t.Object({
        password: t.String(),
        newPassword: t.String()
      })
    }
  )
  .post('/user/delete',
    async ({body: { password }, db, id}) => {
      const hash = (await db.user.findUnique({ where: { id }, select: { password: true} }))?.password
      if (!hash) throw Error('No such user')
      if (!await Bun.password.verify(password, hash)) throw Error('Unauthorized')

      return await db.user.delete({ where: { id } })
    },
    {
      body: t.Object({
        password: t.String()
      })
    }
  )