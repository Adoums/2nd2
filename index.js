const {request} = require("https")
const { exec } = require("child_process");
const token = process.env.token
let seq = null, session_id, heartBeat, gatewayUrl = "wss://gateway.discord.gg/?v=10&encoding=json"
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
            require("fs").appendFileSync("logs.txt", `Error (${new Date().toUTCString()})\n`)
            exec("node index")
            process.kill(1)
          }
            try {
                resolve({body: JSON.parse(body), status: res.statusCode, headers: res.headers})
            } catch(e) {
                resolve({body: null, status: res.statusCode, headers: res.headers})
            }
        })
    }).end(data))
}
;(function connect(bool) {
    const ws = new (require("ws"))(gatewayUrl)
    ws.once("open", () => {
        if(bool) return ws.send(`{"op":6,"d":{"token":"${token}","seq":${seq},"session_id":"${session_id}"}}`)
        ws.send(`{"op":2,"d":{"token":"${token}","properties":{"os":"linux"},"intents":4096,"presence":{"status":"online","afk":false,"activities":[{"name":"/propose => DM","type":1,"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}]}}}`)
    })
    ws.on("message", async m => {
        m = JSON.parse(m)
        seq = m.s || seq
        if(m.op == 1) return ws.send(`{"op":1,"d":${seq}}`)
        if(m.op == 7) return ws.close()
        if(m.op == 9) return console.error("Invalid Token")
        if(m.op == 10) return heartBeat = setInterval(() => ws.send(`{"op":1,"d":${seq}}`), m.d.heartbeat_interval)
        switch(m.t) {
            case "READY":
                session_id = m.d.session_id
                gatewayUrl = m.d.resume_gateway_url
                break
            case "MESSAGE_CREATE":
                if(m.d.author.id != "1030514575449272381") await got("POST", `/channels/${m.d.channel_id}/messages`, `{"content":"Voici mes commandes :\\n\\n\`/propose\` : Proposer une idée ou annoncer quelque chose à la classe."}`)
                break
            case "INTERACTION_CREATE":
                if(m.d.data.name == "propose") return got("POST", `/interactions/${m.d.id}/${m.d.token}/callback`, `{"type":4,"data":{"content":"Cliquez sur le bouton ci-dessous afin d'envoyer un message publiquement dans <#1030525904008523776>","flags":64,"components":[{"type":1,"components":[{"type":2,"custom_id":"type","style":1,"label":"Envoyer un message"}]}]}}`)
                switch(m.d.data.custom_id) {
                    case "type":
                        await got("POST", `/interactions/${m.d.id}/${m.d.token}/callback`, `{"type":9,"data":{"title":"Saisissez le message a envoyer","custom_id":"message","components":[{"type":1,"components":[{"type":4,"style":2,"label":"Message","custom_id":"message"}]}]}}`)
                        break
                    case "message":
                        await got("POST", `/interactions/${m.d.id}/${m.d.token}/callback`, `{"type":7,"data":{"content":"Voici votre message : \`\`\`${m.d.data.components[0].components[0].value.replace(/["`]/gm, '\\"').replace(/\n/gm, "\\n")}\`\`\`\\nVeuillez selectionner votre mode de publication :","flags":64,"components":[{"type":1,"components":[{"type":2,"custom_id":"anonyme","style":1,"label":"Envoyer anonymement","emoji":{"name":"🎭"}},{"type":2,"custom_id":"edit","style":1,"label":"Modifier","emoji":{"name":"📝"}}]}]}}`)
                        break
                    case "edit":
                        await got("POST", `/interactions/${m.d.id}/${m.d.token}/callback`, `{"type":9,"data":{"title":"Saisissez le message a envoyer","custom_id":"message","components":[{"type":1,"components":[{"type":4,"style":2,"label":"Message","custom_id":"message"}]}]}}`)
                        break
                    case "anonyme":
                        await got("POST", `/interactions/${m.d.id}/${m.d.token}/callback`, `{"type":7,"data":{"content":"Votre message a bien été envoyé **en anonyme** !","components":[],"flags":64}}`)
                        await got("POST", `/webhooks/1030580687817932840/JKHISvMJ5nkwuzvruLTvgn1EBWcr4ffxwYnIPPVfGci50CI4WM8o3v-WbHzwCMFN-ChD`, `{"username":"Anonyme","content":"${m.d.message.content.match(/(?<=```)[^`]+(?=```)/gm)[0].replace(/["`]/gm, '\\"').replace(/\n/gm, "\\n")}"}`)
                        break
                }
                break
        }
    })
    ws.on("close", () => {connect(true); clearInterval(heartBeat)})
})()
require("http").createServer((req, res) => res.end('holà')).listen(process.env.port || 9001)
process.on("uncaughtException", async(error) => require("fs").appendFileSync("logs.txt", await got("POST", "/webhooks/1028407149048643615/Hr51KiTG8obi6cIG2k8ofXQMCgmQvxKZ_3raWaNTHvo2OtyMnS1XAGm2mtI_RVdZ8dzd", `{"content":"${error.toString().replace(/"/gm,'\\"')}"}`), {authorization: null}))
process.on("unhandledRejection", async(error) => require("fs").appendFileSync("logs.txt", await got("POST", "/webhooks/1028407149048643615/Hr51KiTG8obi6cIG2k8ofXQMCgmQvxKZ_3raWaNTHvo2OtyMnS1XAGm2mtI_RVdZ8dzd", `{"content":"${error.toString().replace(/"/gm,'\\"')}"}`), {authorization: null}))
