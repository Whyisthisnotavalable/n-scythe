javascript:(function() {
    check();
    function isScythePresent() {
        for (let i = 0; i < simulation.ephemera.length; i++) {
            if (simulation.ephemera[i].name === "scythe") {
                return true; 
            }
        }
        return false; 
    }
    function check() {
        if (!isScythePresent()) {
            active();
        }
        requestAnimationFrame(check);
    }
    const e = {
        name: atob("c2N5dGhl"),
        description: `throw a <b style="color: ">scythe</b> that keeps velocity upon collisions<br>drains <strong class='color-h'>health</strong> instead of ammunition`,
        ammo: 0,
        ammoPack: Infinity,
        have: false,
        do() {},
        fire() {}
    };
    b.guns.push(e);
    const gunArray = b.guns.filter(
    (obj, index, self) =>
        index === self.findIndex((item) => item.name === obj.name)
    );
    b.guns = gunArray;
    function active() {
        simulation.ephemera.push({
            name: "scythe",
            cycle: 0,
            scythe: undefined,
            bladeSegments: undefined,
            bladeTrails: [],
            angle: 0,
            do() {
                if (b.activeGun !== null && input.fire && (tech.isEnergyHealth ? m.energy > 0.11 : m.health >= 0.11)) {
                    if (!this.scythe && b.guns[b.activeGun].name === 'scythe') {
                        ({ scythe: this.scythe, bladeSegments: this.bladeSegments} = this.createAndSwingScythe());
                        this.angle = m.angle;
                        if(tech.isEnergyHealth) {
                            m.energy -= 0.1;
                        } else {
                            m.health -= 0.1;
                            m.displayHealth();
                        }
                    }
                }
                if(this.scythe && m.cycle > this.cycle + 30) {
                    Matter.Body.setAngularVelocity(this.scythe, 0);
                    Composite.remove(engine.world, this.scythe);

                    this.scythe.parts.forEach(part => {
                        Composite.remove(engine.world, part);
                        const index = body.indexOf(part);
                        if (index !== -1) {
                            body.splice(index, 1);
                        }
                    });

                    this.scythe = undefined;
                    this.bladeTrails = [];
                } else {
                    if (this.scythe) {
                        if (!(this.angle > -Math.PI / 2 && this.angle < Math.PI / 2)) {
                            Matter.Body.setAngularVelocity(this.scythe, -Math.PI * 0.15);
                        } else {
                            Matter.Body.setAngularVelocity(this.scythe, Math.PI * 0.15);
                        }
                        Matter.Body.setVelocity(this.scythe, {
                            x: Math.cos(this.angle) * 30,
                            y: Math.sin(this.angle) * 30
                        });
                    }
                }
                if(this.scythe) {
                    for (let i = 0; i < this.bladeSegments.length; i++) {
                        const blade = this.bladeSegments[i];
                        const trail = this.bladeTrails[i] || [];
                        const vertices = blade.vertices.map(vertex => ({ x: vertex.x, y: vertex.y }));
                        trail.push(vertices);
                        if (trail.length > 10) {
                            trail.shift();
                        }
                        this.bladeTrails[i] = trail;
                    }
        
                    for (let i = 0; i < this.bladeTrails.length; i++) {
                        const trail = this.bladeTrails[i];
        
                        const alphaStep = 1 / trail.length;
                        let alpha = 0;
        
                        for (let j = 0; j < trail.length; j++) {
                            const vertices = trail[j];
                            ctx.beginPath();
                            ctx.moveTo(vertices[0].x, vertices[0].y);
        
                            for (let k = 1; k < vertices.length; k++) {
                                ctx.lineTo(vertices[k].x, vertices[k].y);
                            };
        
                            alpha += alphaStep;
                            ctx.closePath();
                            ctx.fillStyle = `rgba(220, 20, 60, ${alpha})`;
                            ctx.fill();
                        }
                    }

                    for(let i = 0; i < this.bladeSegments.length; i++) {
                        ctx.beginPath();
                        ctx.lineJoin = "miter";
                        ctx.miterLimit = 100;
                        ctx.strokeStyle = "crimson";
                        ctx.lineWidth = 5;
                        ctx.fillStyle = "black";
                        ctx.moveTo(this.bladeSegments[i].vertices[0].x, this.bladeSegments[i].vertices[0].y);
                        for(let j = 0; j < this.bladeSegments[i].vertices.length; j++) {
                            ctx.lineTo(this.bladeSegments[i].vertices[j].x, this.bladeSegments[i].vertices[j].y)
                        };
                        ctx.closePath();
                        ctx.stroke();
                        ctx.fill();
                        ctx.lineJoin = "round";
                        ctx.miterLimit = 10;
                    }
                }
                if(this.scythe) {
                    for (let i = 0; i < mob.length; i++) {
                        if (Matter.Query.collides(this.scythe, [mob[i]]).length > 0) {
                            const dmg = m.dmgScale * 0.12 * 2.73;
                            mob[i].damage(dmg, true);
                            simulation.drawList.push({
                                x: mob[i].position.x,
                                y: mob[i].position.y,
                                radius: Math.sqrt(dmg) * 50,
                                color: simulation.mobDmgColor,
                                time: simulation.drawTime
                            });
                            const angle = Math.atan2(mob[i].position.y - this.scythe.position.y, mob[i].position.x - this.scythe.position.x);
                            this.scythe.force.x += Math.cos(angle) * 2;
                            this.scythe.force.y += Math.sin(angle) * 2;
                            break
                        }
                    }
                }
            },
            createAndSwingScythe(x = player.position.x, y = player.position.y, angle = m.angle) {
                if (this.cycle < m.cycle) {
                    this.cycle = m.cycle + 60;
                    const handleWidth = 20;
                    const handleHeight = 200;
                    const handle = Bodies.rectangle(x, y, handleWidth, handleHeight, spawn.propsIsNotHoldable);
                    body[body.length] = handle;
                    const bladeWidth = 100;
                    const bladeHeight = 20;
                    const numBlades = 10;
                    const extensionFactor = 5.5;
                    const bladeSegments = [];
            
                    for (let i = 0; i < numBlades; i++) {
                        const extensionFactorFraction = (i / (numBlades - 1)) * extensionFactor;
                        const bladeX = x - handleWidth / 2 + i * (bladeWidth / 2) - extensionFactorFraction * (bladeWidth / 2);
                        const bladeY = y + handleHeight / 2 - i * (bladeHeight / (3 ** i));
            
                        const vertices = [
                            { x: bladeX, y: bladeY - bladeHeight / 2 }, 
                            { x: bladeX + bladeWidth / 2, y: bladeY + bladeHeight / 2 },
                            { x: bladeX - bladeWidth / 2, y: bladeY + bladeHeight / 2 },
                            { x: bladeX, y: bladeY - bladeHeight / 2 + 10 },
                        ];
            
                        const blade = Bodies.fromVertices(bladeX, bladeY, vertices, spawn.propsIsNotHoldable);
                        body[body.length] = blade;
                        Matter.Body.rotate(blade, -Math.sin(i * (Math.PI / 180) * 5));
                        bladeSegments.push(blade);
                    }
            
                    const scythe = Body.create({
                        parts: [handle, ...bladeSegments],
                    });
            
                    Composite.add(engine.world, scythe);
                    Matter.Body.setPosition(scythe, { x, y });
            
                    scythe.collisionFilter.category = cat.body;
                    scythe.collisionFilter.mask = cat.mobBullet | cat.mob;
            
                    if ((angle > -Math.PI / 2 && angle < Math.PI / 2)) {
                        Body.scale(scythe, -1, 1, { x, y });
                    }

                    scythe.frictionAir -= 0.01;
            
                    return { scythe, bladeSegments };
                }
            },          
        })
    }
})();