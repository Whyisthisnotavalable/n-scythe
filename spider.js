javascript:(function() {
    const spiderGroup = Matter.Body.nextGroup(true);
    function createShard(x, y, angle, length = 40) {
        const verts = [
            { x: -10, y: 0 },
            { x: 0, y: -10 },
            { x: 10, y: 0 },
            { x: 0, y: length }
        ];

        const body = Matter.Bodies.fromVertices(x, y, [verts], {
            collisionFilter: {
                group: spiderGroup
            },
            frictionAir: 0.05,
            friction: 1,
            frictionStatic: 2
        }, true);
        
        Matter.Body.setAngle(body, angle + Math.PI / 2);
        body.frictionAir = 0.05;
        body.friction = 1;
        body.frictionStatic = 2;
        body.restitution = 0;

        Composite.add(engine.world, body);

        return body;
    }
    const originalSetPosition = Matter.Body.setPosition;
    Matter.Body.setPosition = function(body, position) {
        if (body === player && m.isShipMode) {
            m.legs?.forEach(leg => {
                Composite.remove(engine.world, leg.upper);
                Composite.remove(engine.world, leg.lower);
                Composite.remove(engine.world, leg.joint1);
                Composite.remove(engine.world, leg.joint2);
                Composite.remove(engine.world, leg.support);
            });
            m.legs = [];
            originalSetPosition(body, position);
            const legPairs = 4;
            for (let i = 0; i < legPairs; i++) {
                const yOffset = (i - 1) * 15 * Math.random();
                m.legs.push({
                    side: -1,
                    yOffset,
                    upper: null,
                    lower: null
                });
                m.legs.push({
                    side: 1,
                    yOffset,
                    upper: null,
                    lower: null
                });
            }
            m.legs.forEach(leg => {
                const px = player.position.x;
                const py = player.position.y;

                const sx = px + leg.side * 40;
                const sy = py + leg.yOffset + 50;
                const baseAngle = leg.side === 1 ? 0 : Math.PI;

                leg.upper = createShard(sx, sy, baseAngle, 65);
                leg.lower = createShard(sx, sy, baseAngle, 85);
                leg.joint1 = Constraint.create({
                    bodyA: player,
                    pointA: {
                        x: leg.side * 25,
                        y: leg.yOffset
                    },
                    bodyB: leg.upper,
                    pointB: { x: 0, y: -15 },
                    length: 20,
                    stiffness: 0.4,
                    damping: 0.2
                });

                leg.joint2 = Constraint.create({
                    bodyA: leg.upper,
                    pointA: { x: 0, y: 45 },
                    bodyB: leg.lower,
                    pointB: { x: 0, y: -15 },
                    length: 20,
                    stiffness: 0.4,
                    damping: 0.2
                });

                leg.support = Constraint.create({
                    bodyA: leg.upper,
                    pointA: { x: 10 * leg.side, y: 0 },
                    bodyB: leg.lower,
                    pointB: { x: -leg.side * 50, y: 0 },
                    length: 100,
                    stiffness: 0.01,
                    damping: 0.1
                });

                Matter.Body.setMass(leg.lower, 2);
                Matter.Body.setMass(leg.upper, 1);
                Composite.add(engine.world, [leg.joint1, leg.joint2, leg.support]);
                leg.target = { x: 0, y: 0 };
                leg.cooldown = 0;
                leg.state = "plant";
                leg.timer = 0;
                leg.home = { x: 0, y: 0 };
            });
            m.legs.forEach((leg, i) => {
                leg.group = (Math.floor(i / 2) + leg.side + 2) % 2; // 0 or 1
            });
            return;
        }
        return originalSetPosition(body, position);
    };
    const oldStart = simulation.startGame;
    simulation.startGame = function(isBuildRun = false, isTrainingRun = false) {
        m.legs?.forEach(leg => {
            Composite.remove(engine.world, leg.upper);
            Composite.remove(engine.world, leg.lower);
            Composite.remove(engine.world, leg.joint1);
            Composite.remove(engine.world, leg.joint2);
            Composite.remove(engine.world, leg.support);
        });
        m.legs = [];
        oldStart(isBuildRun, isTrainingRun);
        setTimeout(()=>{
            spider.shipMode();
            m.draw = () => { 
                m.legs.forEach(leg => {
                    m.drawShard(leg.upper);
                    m.drawShard(leg.lower);
                });
                ctx.save();
                ctx.globalAlpha = (m.immuneCycle < m.cycle) ? 1 : m.cycle % 3 ? 0.1 : 0.65 + 0.1 * Math.random()
                ctx.translate(player.position.x, player.position.y);
                ctx.rotate(m.angle);
                ctx.beginPath();
                ctx.arc(0, 0, 30, 0, 2 * Math.PI);
                ctx.fillStyle = m.bodyGradient
                ctx.fill();
                ctx.arc(15, 0, 4, 0, 2 * Math.PI);
                ctx.strokeStyle = "#333";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }
        }, 100)
    }
    const oldDeath = m.death;
    m.death = function() {
         m.legs?.forEach(leg => {
            Composite.remove(engine.world, leg.upper);
            Composite.remove(engine.world, leg.lower);
            Composite.remove(engine.world, leg.joint1);
            Composite.remove(engine.world, leg.joint2);
            Composite.remove(engine.world, leg.support);
        });
        m.legs = [];
        oldDeath();
    }
    const spider = {
        shipMode() {
            m.drawShard = function(body) {
                ctx.beginPath();
                ctx.moveTo(body.vertices[0].x, body.vertices[0].y);

                for (let v of body.vertices) {
                    ctx.lineTo(v.x, v.y);
                }

                ctx.closePath();
                ctx.strokeStyle = "crimson";
                ctx.lineWidth = 3;
                ctx.fillStyle = "black";
                ctx.stroke();
                ctx.fill();
            }
            if (!m.isShipMode) {
                player.collisionFilter.group = spiderGroup;
                for (let i = 0; i < mob.length; i++) {
                    if (!mob[i].freeOfWires) mob[i].freeOfWires = true
                }
                m.isShipMode = true
                m.legs = [];
                const legPairs = 4;
                for (let i = 0; i < legPairs; i++) {
                    const yOffset = (i - 1) * 15 * Math.random();
                    m.legs.push({
                        side: -1,
                        yOffset,
                        upper: null,
                        lower: null
                    });
                    m.legs.push({
                        side: 1,
                        yOffset,
                        upper: null,
                        lower: null
                    });
                }
                m.legs.forEach(leg => {
                    const px = player.position.x;
                    const py = player.position.y;

                    const sx = px + leg.side * 40;
                    const sy = py + leg.yOffset + 50;
                    const baseAngle = leg.side === 1 ? 0 : Math.PI;

                    leg.upper = createShard(sx, sy, baseAngle, 65);
                    leg.lower = createShard(sx, sy, baseAngle, 85);
                    leg.joint1 = Constraint.create({
                        bodyA: player,
                        pointA: {
                            x: leg.side * 25,
                            y: leg.yOffset
                        },
                        bodyB: leg.upper,
                        pointB: { x: 0, y: -15 },
                        length: 20,
                        stiffness: 0.4,
                        damping: 0.2
                    });

                    leg.joint2 = Constraint.create({
                        bodyA: leg.upper,
                        pointA: { x: 0, y: 45 },
                        bodyB: leg.lower,
                        pointB: { x: 0, y: -15 },
                        length: 20,
                        stiffness: 0.4,
                        damping: 0.2
                    });

                    leg.support = Constraint.create({
                        bodyA: leg.upper,
                        pointA: { x: 10 * leg.side, y: 0 },
                        bodyB: leg.lower,
                        pointB: { x: -leg.side * 50, y: 0 },
                        length: 100,
                        stiffness: 0.01,
                        damping: 0.1
                    });

                    Matter.Body.setMass(leg.lower, 2);
                    Matter.Body.setMass(leg.upper, 1);
                    Composite.add(engine.world, [leg.joint1, leg.joint2, leg.support]);
                    leg.target = { x: 0, y: 0 };
                    leg.cooldown = 0;
                    leg.state = "plant";
                    leg.timer = 0;
                    leg.home = { x: 0, y: 0 };
                });
                m.legs.forEach((leg, i) => {
                    leg.group = (Math.floor(i / 2) + leg.side + 2) % 2; // 0 or 1
                });
                const points = [{
                    x: 29.979168754143455,
                    y: 4.748337243898336
                },
                {
                    x: 27.04503734408824,
                    y: 13.7801138209198
                },
                {
                    x: 21.462582474874278,
                    y: 21.462582475257523
                },
                {
                    x: 13.780113820536943,
                    y: 27.045037344471485
                },
                {
                    x: 4.74833724351507,
                    y: 29.979168754526473
                },
                {
                    x: -4.748337245049098,
                    y: 29.979168754526473
                },
                {
                    x: -13.780113822071026,
                    y: 27.045037344471485
                },
                {
                    x: -21.46258247640829,
                    y: 21.462582475257523
                },
                {
                    x: -27.045037345621797,
                    y: 13.7801138209198
                },
                {
                    x: -29.979168755677012,
                    y: 4.748337243898336
                },
                {
                    x: -29.979168755677012,
                    y: -4.7483372446656045
                },
                {
                    x: -27.045037345621797,
                    y: -13.78011382168726
                },
                {
                    x: -21.46258247640829,
                    y: -21.462582476024817
                },
                {
                    x: -13.780113822071026,
                    y: -27.045037345239006
                },
                {
                    x: -4.748337245049098,
                    y: -29.97916875529422
                },
                {
                    x: 4.74833724351507,
                    y: -29.97916875529422
                },
                {
                    x: 13.780113820536943,
                    y: -27.045037345239006
                },
                {
                    x: 21.462582474874278,
                    y: -21.462582476024817
                },
                {
                    x: 27.04503734408824,
                    y: -13.78011382168726
                },
                {
                    x: 29.979168754143455,
                    y: -4.7483372446656045
                }
                ]
                Matter.Body.scale(player, 0.0001, 0.0001);
                Matter.Body.setVertices(player, Matter.Vertices.create(points, player))
                player.parts.pop()
                player.parts.pop()
                player.parts.pop()
                player.parts.pop()
                m.defaultMass = 8
                Matter.Body.setMass(player, m.defaultMass);
                player.friction = 0.01
                player.restitution = 0.2
                Matter.Body.setInertia(player, Infinity)
                m.onGround = false
                m.lastOnGroundCycle = 0
                m.move = () => {
                    m.pos.x = player.position.x;
                    m.pos.y = player.position.y;
                    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
                    const activeGroup = Math.floor(m.cycle / 25) % 2;
                    Matter.Body.applyForce(player, player.position, {
                        x: 0, 
                        y: player.mass * simulation.g
                    })
                    m.legs.forEach((leg, i) => {
                        // simulation.ephemera.push({
                        //     name: "q" + Math.random(),
                        //     do() {
                        //         const bodyA = leg.support.bodyA;
                        //         const bodyB = leg.support.bodyB;
                        //         const worldA = {
                        //             x: bodyA.position.x + leg.support.pointA.x * Math.cos(bodyA.angle) - leg.support.pointA.y * Math.sin(bodyA.angle),
                        //             y: bodyA.position.y + leg.support.pointA.x * Math.sin(bodyA.angle) + leg.support.pointA.y * Math.cos(bodyA.angle)
                        //         };
                        //         const worldB = {
                        //             x: bodyB.position.x + leg.support.pointB.x * Math.cos(bodyB.angle) - leg.support.pointB.y * Math.sin(bodyB.angle),
                        //             y: bodyB.position.y + leg.support.pointB.x * Math.sin(bodyB.angle) + leg.support.pointB.y * Math.cos(bodyB.angle)
                        //         };
                        //         ctx.beginPath();
                        //         ctx.moveTo(worldA.x, worldA.y);
                        //         ctx.lineTo(worldB.x, worldB.y);
                        //         ctx.stroke();

                        //         simulation.removeEphemera(this.name, true);
                        //     }
                        // });
                        Matter.Body.applyForce(leg.lower, leg.lower.position, {
                            x: 0,
                            y: leg.lower.mass * simulation.g
                        });
                        Matter.Body.applyForce(leg.upper, leg.upper.position, {
                            x: 0,
                            y: leg.upper.mass * simulation.g
                        });
                        const stepForward = 100;
                        const stepDown = 180;
                        const liftHeight = 60;
                        const tx = player.position.x 
                            + dir * stepForward 
                            + leg.side * 40 
                            + leg.yOffset * 1.5;
                        const groundY = player.position.y + stepDown + leg.yOffset;
                        const swingY = groundY - liftHeight;

                        const dx = tx - leg.lower.position.x;
                        const dy = swingY - leg.lower.position.y;
                        const dist = Math.hypot(dx, dy);
                        Matter.Body.applyForce(player, player.position, {
                            x: 0,
                            y: -dy * 0.0001
                        });
                        if(input.up && (Matter.Query.collides(leg.lower, map).length || Matter.Query.collides(leg.lower, body).length)) {
                            Matter.Body.applyForce(player, player.position, {
                                x: 0, 
                                y: -player.mass * simulation.g * 30
                            })
                            Matter.Body.applyForce(leg.lower, leg.lower.position, {
                                x: 0,
                                y: -leg.lower.mass * simulation.g * 30
                            });
                            Matter.Body.applyForce(leg.upper, leg.upper.position, {
                                x: 0,
                                y: -leg.upper.mass * simulation.g * 30
                            });
                        } else if(input.down) {
                            Matter.Body.applyForce(player, player.position, {
                                x: 0, 
                                y: player.mass * simulation.g * 3
                            })
                            Matter.Body.applyForce(leg.lower, leg.lower.position, {
                                x: 0,
                                y: leg.lower.mass * simulation.g * 3
                            });
                            Matter.Body.applyForce(leg.upper, leg.upper.position, {
                                x: 0,
                                y: leg.upper.mass * simulation.g * 3
                            });
                        } 
                        if(dir != 0) {
                            if (leg.group === activeGroup) {
                                if (leg.state === "plant" && dist > 50) {
                                    leg.state = "lift";
                                    leg.timer = 250;
                                    leg.home.x = leg.lower.position.x;
                                    leg.home.y = leg.lower.position.y;
                                }

                                if (leg.state === "lift") {
                                    Matter.Body.applyForce(leg.lower, leg.lower.position, {
                                        x: 0,
                                        y: -leg.lower.mass * simulation.g * 3 - 0.01
                                    });
                                    Matter.Body.applyForce(leg.upper, leg.upper.position, {
                                        x: 0,
                                        y: -leg.upper.mass * simulation.g * 3 - 0.01
                                    });

                                    leg.timer--;
                                    const groundY = player.position.y + stepDown + leg.yOffset;
                                    if (leg.timer <= 0 || leg.lower.position.y < groundY - 30) {
                                        leg.state = "swing";
                                    }
                                } else if (leg.state === "swing") {
                                    leg.joint2.damping = 0.002;
                                    const tx = player.position.x + dir * stepForward;
                                    const groundY = player.position.y + stepDown + leg.yOffset;
                                    const swingY = groundY - liftHeight;
                                    const dx = tx - leg.lower.position.x;
                                    const dy = swingY - leg.lower.position.y;
                                    Matter.Body.applyForce(leg.lower, leg.lower.position, {
                                        x: dx * 0.0005,
                                        y: dy * 0.0005 + leg.lower.mass * simulation.g * 0.9
                                    });
                                    if (Math.abs(dx) < 15 && Math.abs(leg.lower.position.y - groundY) < 15) {
                                        leg.state = "plant";
                                    }
                                }
                            } else {
                                leg.joint2.damping = 0.2;
                                // Matter.Body.setVelocity(leg.lower, {
                                //     x: leg.lower.velocity.x * 0.6,
                                //     y: leg.lower.velocity.y * 0.6
                                // });
                            }

                            if (leg.state === "plant") {
                                leg.upper.angularVelocity *= 0.7;
                                const tx = player.position.x + dir * stepForward + leg.side * 40 + leg.yOffset * 1.5;
                                const groundY = player.position.y + stepDown + leg.yOffset;

                                const dx = tx - leg.lower.position.x;
                                const dy = groundY - leg.lower.position.y;

                                Matter.Body.applyForce(leg.lower, leg.lower.position, {
                                    x: dx * 0.0003,
                                    y: dy * 0.001
                                });
                            }
                        }
                        const dx2 = leg.lower.position.x - leg.upper.position.x;
                        const dy2 = leg.lower.position.y - leg.upper.position.y;

                        const angle = Math.atan2(dy2, dx2);
                        Matter.Body.setAngle(leg.upper, angle - Math.PI / 2);
                        Matter.Body.setAngle(leg.lower, 0);
                    });
                    m.Vx = player.velocity.x;
                    m.Vy = player.velocity.y;
                    m.history.splice(m.cycle % 600, 1, {
                        position: {
                            x: player.position.x,
                            y: player.position.y,
                        },
                        velocity: {
                            x: player.velocity.x,
                            y: player.velocity.y
                        },
                        yOff: m.yOff,
                        angle: m.angle,
                        health: m.health,
                        energy: m.energy,
                        activeGun: b.activeGun
                    });
                }

                m.draw = () => { 
                    m.legs.forEach(leg => {
                        m.drawShard(leg.upper);
                        m.drawShard(leg.lower);
                    });
                    ctx.save();
                    ctx.globalAlpha = (m.immuneCycle < m.cycle) ? 1 : m.cycle % 3 ? 0.1 : 0.65 + 0.1 * Math.random()
                    ctx.translate(player.position.x, player.position.y);
                    ctx.rotate(m.angle);
                    ctx.beginPath();
                    ctx.arc(0, 0, 30, 0, 2 * Math.PI);
                    ctx.fillStyle = m.bodyGradient
                    ctx.fill();
                    ctx.arc(15, 0, 4, 0, 2 * Math.PI);
                    ctx.strokeStyle = "#333";
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.restore();
                }
                collisionChecks = function (event) {
                    const pairs = event.pairs;
                    for (let i = 0, j = pairs.length; i != j; i++) {
                        for (let k = 0; k < mob.length; k++) {
                            if (mob[k].alive && m.alive) {
                                if (pairs[i].bodyA === mob[k]) {
                                    collideMob(pairs[i].bodyB);
                                    break;
                                } else if (pairs[i].bodyB === mob[k]) {
                                    collideMob(pairs[i].bodyA);
                                    break;
                                }

                                function collideMob(obj) {
                                    //player + mob collision
                                    if (
                                        m.immuneCycle < m.cycle &&
                                        // (obj === playerBody || obj === playerHead) &&
                                        (obj === player) &&
                                        !mob[k].isSlowed && !mob[k].isStunned
                                    ) {
                                        mob[k].foundPlayer();
                                        let dmg = Math.min(Math.max(0.025 * Math.sqrt(mob[k].mass), 0.05), 0.3) * mob[k].damageScale();
                                        if (tech.isRewindAvoidDeath && (m.energy + 0.05) > Math.min(0.95, m.maxEnergy) && dmg > 0.01) { //CPT reversal runs in m.damage, but it stops the rest of the collision code here too
                                            m.takeDamage(dmg);
                                            return
                                        }
                                        m.takeDamage(dmg);
                                        if (tech.isPiezo) m.energy += 20.48 * level.isReducedRegen;
                                        if (tech.isStimulatedEmission) powerUps.ejectTech()
                                        if (mob[k].onHit) mob[k].onHit();
                                        if (m.immuneCycle < m.cycle + m.collisionImmuneCycles) m.immuneCycle = m.cycle + m.collisionImmuneCycles; //player is immune to damage for 30 cycles
                                        //extra kick between player and mob              //this section would be better with forces but they don't work...
                                        let angle = Math.atan2(player.position.y - mob[k].position.y, player.position.x - mob[k].position.x);
                                        Matter.Body.setVelocity(player, {
                                            x: player.velocity.x + 8 * Math.cos(angle),
                                            y: player.velocity.y + 8 * Math.sin(angle)
                                        });
                                        Matter.Body.setVelocity(mob[k], {
                                            x: mob[k].velocity.x - 8 * Math.cos(angle),
                                            y: mob[k].velocity.y - 8 * Math.sin(angle)
                                        });

                                        if (tech.isAnnihilation && !mob[k].shield && !mob[k].isShielded && !mob[k].isBoss && mob[k].isDropPowerUp && m.energy > 0.08) {
                                            m.energy -= 0.08 //* Math.max(m.maxEnergy, m.energy) //0.33 * m.energy
                                            m.immuneCycle = 0; //player doesn't go immune to collision damage
                                            mob[k].death();
                                            simulation.drawList.push({ //add dmg to draw queue
                                                x: pairs[i].activeContacts[0].vertex.x,
                                                y: pairs[i].activeContacts[0].vertex.y,
                                                radius: dmg * 1000,
                                                color: "rgba(255,0,255,0.2)",
                                                time: simulation.drawTime
                                            });
                                        } else {
                                            simulation.drawList.push({ //add dmg to draw queue
                                                x: pairs[i].activeContacts[0].vertex.x,
                                                y: pairs[i].activeContacts[0].vertex.y,
                                                radius: dmg * 500,
                                                color: simulation.mobDmgColor,
                                                time: simulation.drawTime
                                            });
                                        }
                                        return;
                                        // }
                                    }
                                    //mob + bullet collisions
                                    if (obj.classType === "bullet" && obj.speed > obj.minDmgSpeed) {
                                        obj.beforeDmg(mob[k]); //some bullets do actions when they hits things, like despawn //forces don't seem to work here
                                        let dmg = (obj.dmg + 0.15 * obj.mass * Vector.magnitude(Vector.sub(mob[k].velocity, obj.velocity)))
                                        if (tech.isCrit && mob[k].isStunned) dmg *= 4
                                        mob[k].damage(dmg);
                                        if (mob[k].alive) mob[k].foundPlayer();
                                        if (mob[k].damageReduction) {
                                            simulation.drawList.push({ //add dmg to draw queue
                                                x: pairs[i].activeContacts[0].vertex.x,
                                                y: pairs[i].activeContacts[0].vertex.y,
                                                radius: Math.log(dmg + 1.1) * 40 * mob[k].damageReduction + 3,
                                                color: simulation.playerDmgColor,
                                                time: simulation.drawTime
                                            });
                                        }
                                        return;
                                    }
                                    //mob + body collisions
                                    if (obj.classType === "body" && obj.speed > 6) {
                                        const v = Vector.magnitude(Vector.sub(mob[k].velocity, obj.velocity));
                                        if (v > 9) {
                                            let dmg = tech.blockDamage * v * obj.mass * (tech.isMobBlockFling ? 2 : 1);
                                            if (mob[k].isShielded) dmg *= 0.7
                                            mob[k].damage(dmg, true);
                                            if (tech.isBlockPowerUps && !mob[k].alive && mob[k].isDropPowerUp && Math.random() < 0.5) {
                                                let type = "ammo"
                                                if (Math.random() < 0.4) {
                                                    type = "heal"
                                                } else if (Math.random() < 0.4 && !tech.isSuperDeterminism) {
                                                    type = "research"
                                                }
                                                powerUps.spawn(mob[k].position.x, mob[k].position.y, type);
                                                // for (let i = 0, len = Math.ceil(2 * Math.random()); i < len; i++) {}
                                            }

                                            const stunTime = dmg / Math.sqrt(obj.mass)
                                            if (stunTime > 0.5) mobs.statusStun(mob[k], 30 + 60 * Math.sqrt(stunTime))
                                            if (mob[k].alive && mob[k].distanceToPlayer2() < 1000000 && !m.isCloak) mob[k].foundPlayer();
                                            if (tech.fragments && obj.speed > 10 && !obj.hasFragmented) {
                                                obj.hasFragmented = true;
                                                b.targetedNail(obj.position, tech.fragments * 4)
                                            }
                                            if (mob[k].damageReduction) {
                                                simulation.drawList.push({
                                                    x: pairs[i].activeContacts[0].vertex.x,
                                                    y: pairs[i].activeContacts[0].vertex.y,
                                                    radius: Math.log(dmg + 1.1) * 40 * mob[k].damageReduction + 3,
                                                    color: simulation.playerDmgColor,
                                                    time: simulation.drawTime
                                                });
                                            }
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
    }
    if(simulation.onTitlePage == false) {
        spider.shipMode();
    }
})();