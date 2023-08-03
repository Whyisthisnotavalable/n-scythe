javascript:(function() {

const e = {name: atob("c2N5dGhl"),description: atob("VGhyb3cgYSA8c3Ryb25nIHN0eWxlPSdjb2xvcjogY3JpbXNvbjsnPiBzY3l0aGU8L3N0cm9uZz4gdGhhdCBzcGVlZHMgdXAgd2l0aCBjb2xsaXNpb25zPGJyPkRyYWlucyBhbGwgb2YgeW91ciA8c3Ryb25nIGNsYXNzPSdjb2xvci1mJz5lbmVyZ3k8L3N0cm9uZz4") ,ammo: 0,ammoPack: Infinity,have: false,do() {},fire() {}}; b.guns.push(e); 
simulation.ephemera.push({
    name: "ml",
    cc: 0,
    s: void 0,
    bs: void 0,
    bt: [],
    angle: 0,
    do() {
        if (12 == b.activeGun && input.fire && m.energy == m.maxEnergy && (this.s || (({
                s: this.s,
                bs: this.bs
            } = this.cs()), this.angle = m.angle, m.energy -= m.maxEnergy)), this.s && m.cycle > this.cc + 30 ? (Matter.Body.setAngularVelocity(this.s, 0), Composite.remove(engine.world, this.s), this.s.parts.forEach(e => {
                Composite.remove(engine.world, e);
                const t = body.indexOf(e); - 1 !== t && body.splice(t, 1)
            }), this.s = void 0, this.bt = []) : this.s && (this.angle > -Math.PI / 2 && this.angle < Math.PI / 2 ? Matter.Body.setAngularVelocity(this.s, .15 * Math.PI) : Matter.Body.setAngularVelocity(this.s, .15 * -Math.PI), Matter.Body.setVelocity(this.s, {
                x: 30 * Math.cos(this.angle),
                y: 30 * Math.sin(this.angle)
            })), this.s) {
            for (let e = 0; e < this.bs.length; e++) {
                const t = this.bs[e],
                    s = this.bt[e] || [],
                    o = t.vertices.map(e => ({
                        x: e.x,
                        y: e.y
                    }));
                s.push(o), s.length > 10 && s.shift(), this.bt[e] = s
            }
            for (let e = 0; e < this.bt.length; e++) {
                const t = this.bt[e],
                    s = 1 / t.length;
                let o = 0;
                for (let e = 0; e < t.length; e++) {
                    const i = t[e];
                    ctx.beginPath(), ctx.moveTo(i[0].x, i[0].y);
                    for (let e = 1; e < i.length; e++) ctx.lineTo(i[e].x, i[e].y);
                    o += s, ctx.closePath(), ctx.fillStyle = `rgba(220, 20, 60, ${o})`, ctx.fill()
                }
            }
            for (let e = 0; e < this.bs.length; e++) {
                ctx.beginPath(), ctx.lineJoin = "miter", ctx.miterLimit = 100, ctx.strokeStyle = "crimson", ctx.lineWidth = 5, ctx.fillStyle = "black", ctx.moveTo(this.bs[e].vertices[0].x, this.bs[e].vertices[0].y);
                for (let t = 0; t < this.bs[e].vertices.length; t++) ctx.lineTo(this.bs[e].vertices[t].x, this.bs[e].vertices[t].y);
                ctx.closePath(), ctx.stroke(), ctx.fill(), ctx.lineJoin = "round", ctx.miterLimit = 10
            }
        }
        if (this.s)
            for (let e = 0; e < mob.length; e++)
                if (Matter.Query.collides(this.s, [mob[e]]).length > 0) {
                    const t = .12 * m.dmgScale * 2.73;
                    mob[e].damage(t, !0), simulation.drawList.push({
                        x: mob[e].position.x,
                        y: mob[e].position.y,
                        radius: 50 * Math.sqrt(t),
                        color: simulation.mobDmgColor,
                        time: simulation.drawTime
                    });
                    const s = Math.atan2(mob[e].position.y - this.s.position.y, mob[e].position.x - this.s.position.x);
                    this.s.force.x += 2 * Math.cos(s), this.s.force.y += 2 * Math.sin(s);
                    break
                }
    },
    cs(e = player.position.x, t = player.position.y, s = m.angle) {
        if (this.cc < m.cycle) {
            this.cc = m.cycle + 60;
            const o = 20,
                i = 200,
                a = Bodies.rectangle(e, t, o, i, spawn.propsIsNotHoldable);
            body[body.length] = a;
            const l = 100,
                n = 20,
                c = 10,
                h = 5.5,
                r = [];
            for (let s = 0; s < c; s++) {
                const a = e - o / 2 + s * (l / 2) - s / (c - 1) * h * (l / 2),
                    m = t + i / 2 - s * (n / 3 ** s),
                    y = [{
                        x: a,
                        y: m - n / 2
                    }, {
                        x: a + l / 2,
                        y: m + n / 2
                    }, {
                        x: a - l / 2,
                        y: m + n / 2
                    }, {
                        x: a,
                        y: m - n / 2 + 10
                    }],
                    d = Bodies.fromVertices(a, m, y, spawn.propsIsNotHoldable);
                body[body.length] = d, Matter.Body.rotate(d, -Math.sin(s * (Math.PI / 180) * 5)), r.push(d)
            }
            const y = Body.create({
                parts: [a, ...r]
            });
            return Composite.add(engine.world, y), Matter.Body.setPosition(y, {
                x: e,
                y: t
            }), y.collisionFilter.category = cat.body, y.collisionFilter.mask = cat.mobBullet | cat.mob, s > -Math.PI / 2 && s < Math.PI / 2 && Body.scale(y, -1, 1, {
                x: e,
                y: t
            }), y.frictionAir -= .01, {
                s: y,
                bs: r
            }
        }
    }
})


})();