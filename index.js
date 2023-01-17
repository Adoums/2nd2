const {request} = require("https")
const {exec} = require("child_process")
const {appendFileSync} = require("fs")
const token = process.env.token
let seq = null, session_id, interval, gatewayUrl = "wss://gateway.discord.gg/?v=10&encoding=json", resume = true
function got(method, endpoint, data, headers = {}) {
    return new Promise(resolve => request({
        method,
        host: "discord.com",
        path: `/api/v10/${endpoint}`,
        headers: {
          authorization: `Bot ${token}`, 
          "content-type": "application/json",
          "user-agent":"DiscordBot (https://github.com/Rapptz/discord.py 0.2)",
          ...headers}
    }, res => {
        let body = ""
        res.on("data", chunk => body += chunk)
        res.on("end", () => {
          if(body.startsWith("error")) {
            appendFileSync("logs.txt", `Error (${new Date().toUTCString()})\n`)
            exec("node index")
            process.kill(1)
          }
          let result = {status: res.statusCode}
            try {
                Object.assign(result, JSON.parse(body))
            } catch(e) {}
          resolve(result)
        })
    }).end(data))
}
;(function connect(bool) {
    const ws = new (require("ws"))(gatewayUrl)
    ws.once("open", () => {
        if(bool) return ws.send(`{"op":6,"d":{"token":"${token}","seq":${seq},"session_id":"${session_id}"}}`)
        ws.send(`{"op":2,"d":{"token":"${token}","properties":{"os":"linux"},"intents":4096,"presence":{"status":"online","afk":false,"activities":[{"name":"/propose => DM","type":1,"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}]}}}`)
    })
    function close(bool) {
      resume = bool
      ws.close(1000)
    }
    ws.on("message", async m => {
        m = JSON.parse(m)
        seq = m.s || seq
        if(m.op == 1) return ws.send(`{"op":1,"d":${seq}}`)
        if(m.op == 7) return close(true)
        if(m.op == 9 && m.d) return close(false)
        else if(m.op == 9) return close(true)
        if(m.op == 10) return interval = setInterval(() => ws.send(`{"op":1,"d":${seq}}`), m.d.heartbeat_interval)
        switch(m.t) {
            case "READY":
                session_id = m.d.session_id
                gatewayUrl = `${m.d.resume_gateway_url}/?v=10&encoding=json`
                break
            case "MESSAGE_CREATE":
                if(m.d.author.id != "1030514575449272381") await got("POST", `/channels/${m.d.channel_id}/messages`, `{"content":"Voici mes commandes :\\n\\n\`/propose\` : Proposer une idée ou annoncer quelque chose à la classe."}`)
                break
            case "INTERACTION_CREATE":
                if(m.d.data.name == "propose") return got("POST", `/interactions/${m.d.id}/${m.d.token}/callback`, `{"type":4,"data":{"content":"Voici votre message : \`\`\`${m.d.data.options[0].value.replace(/["`]/gm, '\\"').replace(/\n/gm, "\\n")}\`\`\`","flags":64,"components":[{"type":1,"components":[{"type":2,"custom_id":"anonyme","style":1,"label":"Envoyer anonymement","emoji":{"name":"🎭"}},{"type":2,"custom_id":"edit","style":1,"label":"Modifier","emoji":{"name":"📝"}}]}]}}`)
                switch(m.d.data.custom_id) {
                    case "message":
                        await got("POST", `/interactions/${m.d.id}/${m.d.token}/callback`, `{"type":7,"data":{"content":"Voici votre message : \`\`\`${m.d.data.components[0].components[0].value.replace(/["`]/gm, '\\"').replace(/\n/gm, "\\n")}\`\`\`","flags":64,"components":[{"type":1,"components":[{"type":2,"custom_id":"anonyme","style":1,"label":"Envoyer anonymement","emoji":{"name":"🎭"}},{"type":2,"custom_id":"edit","style":1,"label":"Modifier","emoji":{"name":"📝"}}]}]}}`)
                        break
                    case "edit":
                        await got("POST", `/interactions/${m.d.id}/${m.d.token}/callback`, `{"type":9,"data":{"title":"Saisissez le message a envoyer","custom_id":"message","components":[{"type":1,"components":[{"type":4,"style":2,"label":"Message","custom_id":"message"}]}]}}`)
                        break
                    case "anonyme":
                        await got("POST", `/interactions/${m.d.id}/${m.d.token}/callback`, `{"type":7,"data":{"content":"Votre message a bien été envoyé **en anonyme** !","components":[],"flags":64}}`)
                        let message = await got("POST", `/webhooks/1030580687817932840/JKHISvMJ5nkwuzvruLTvgn1EBWcr4ffxwYnIPPVfGci50CI4WM8o3v-WbHzwCMFN-ChD?wait=true`, `{"username":"Anonyme","content":"${m.d.message.content.match(/(?<=```)[^`]+(?=```)/gm)[0].replace(/["`]/gm, '\\"').replace(/\n/gm, "\\n")}"}`)
                        await got("PUT", `/channels/${message.channel_id}/messages/${message.id}/reactions/yes:1047189209057873920/@me`)
                        setTimeout(() => got("PUT", `/channels/${message.channel_id}/messages/${message.id}/reactions/no:1047189425110650950/@me`), 500)
                        break
                }
                break
        }
    })
    ws.on("close", (code) => {
      clearInterval(interval)
      if(code >= 4000 || !resume) {
        appendFileSync("logs.txt", `${code}\n`)
        return connect(false)
      }
      connect(true)
    })
})()
require("http").createServer((req, res) => res.end()).listen(80)
process.on("unhandledRejection", console.log)
process.on("uncaughtException", console.log)
