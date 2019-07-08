var canvas = document.getElementById("canvas");
    canvas.style.cursor = "none";
var ctx = canvas.getContext("2d");

let entityControl = function(canvas,ctx) {
    let self = {
        canvas: canvas,
        ctx: ctx,
        entities:{
            enemy:{},
            tower:{}
        },
        enemyEnity: function(subType='basic',args) {
            let self = {
                type:'enemy',
                subType,
                travel: args.travel,
                speed: args.speed/100,
                activeSegment:0,
                color: args.color,
                position:{x:-1,y:-1},
                size:{type:'cubic',width:20,height:20},
                influence:{attackRadius:20},
                health:1,
                currentHealth:1,
                trace:args.trace || false
            }
            return self;
        },
        towerEnity: function(subType='basic',args) {
            let self = {
                type:'tower',
                subType,
                color: args.color,
                position: args.position,
                size:{type:'radial',radius:args.radius},
                influence:{attackRadius:args.attackRadius},
                attack:{rate:args.attack.rate,power:args.attack.power,coolDown:0}
            }
            return self;
        },
        addEnity: function(type,subType='basic',args={}) {
            let self = this;
            switch(type){
                case 'enemy':
                    self.entities.enemy[self.uuidv4()] = self.enemyEnity(subType,args);
                    break;
                case 'tower':
                    self.entities.tower[self.uuidv4()] = self.towerEnity(subType,args);
                    break;
            }
        },
        draw: function() {
            let self = this;
            for(let entityGroupIndex in self.entities) {
                let entityGroup = self.entities[entityGroupIndex];
                for(let entityIndex in entityGroup) {
                    let entity = entityGroup[entityIndex];
                    if(entity.type == 'enemy' && entity.travel < 0){
                        continue;
                    }
                    if(entity.influence) {
                        self.drawInfluencePerType(entity);
                    }
                    self.ctx.fillStyle = 'rgba('+entity.color.r+','+entity.color.g+','+entity.color.b+','+entity.health+')';
                    self.drawBoundriesPerType(entity);
                }
            }
        },
        drawBoundriesPerType: function(entity) {
            let self = this;
                self.ctx.beginPath();
            switch(entity.size.type) {
                case 'cubic':
                    self.ctx.rect(entity.position.x - entity.size.width/2, entity.position.y - entity.size.height/2, entity.size.width, entity.size.height);
                    break;
                case 'radial':
                    self.ctx.arc(entity.position.x, entity.position.y, entity.size.radius,0*Math.PI,2*Math.PI);
                    break;
            }
            self.ctx.fill();
        },
        drawInfluencePerType: function(entity) {
            let self = this;
            let influenceEntitiy = {
                    position: {
                        x:entity.position.x,
                        y:entity.position.y
                    },
                    size: {
                        type: 'radial',
                        radius: entity.influence.attackRadius
                    }
                };

            self.ctx.fillStyle = "rgba(255,255,255,.2)";
            self.drawBoundriesPerType(influenceEntitiy);
        },
        removeEntity: function(uuidv4) {
            let self = this;
            for(let entityGroupIndex in self.entities) {
                let entityGroup = self.entities[entityGroupIndex];
                if(uuidv4 in entityGroup){
                    delete entityGroup[uuidv4];
                }
            }
        },
        uuidv4: function() {
          return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
          )
        }

    };
    return self;
};


let pathControl = function(canvas,ctx){
    let self = {
        canvas: canvas,
        ctx: ctx,
        current: {x:0,y:0},
        paths: [],
        start:{x:0,y:0},
        end:{x:0,y:0},
        pathLength: 0,
        segmentLength: 20,
        currentDirection: {x:true,y:true},
        direction: {
            x:true, // Moving Right?
            y:true,  // Moving Down?
            xTravel:0,
            yTravel:0
        },
        startPath: function(x,y) {
            var self = this;
                self.start = {x,y};
                self.setPoint(x,y)
        },
        setPoint: function(x,y) {
            this.current = {x,y};
        },
        addPath: function(lineType,lineArgs={},lineRender=true,calucate=false){
            this.paths.push({
                lineType,
                lineArgs,
                lineRender,
                length:{
                    total:0,
                    start:0,
                    end:0
                },
                point:{x:0,y:0},
                percentage: {
                    total:0,
                    start:0,
                    end:0
                },
                calucate
            });
        },
        /**
         * addRightAngleCurve 
         * @param Int       size        Pixel length of curve
         * @param Object    moving      x: True/Right, False/Left; y: True/Down, False/Up
         * @param Boolean   lineRender  Display line to canvas
         */
        addRightAngleCurve: function(size=10,moving={x:true,y:true},lineRender=true){
            let self = this,
                lineArgs = {
                    controlPointX:moving.x ? size : -size,
                    controlPointY:moving.y ? size : -size,
                    x:moving.x ? size : -size,
                    y:moving.y ? size : -size
                };
            self.addPath(
                'curve',
                lineArgs,
                lineRender,
                true
            );
        },
        /**
         * addRightAngleCurve 
         * @param Int       size        Pixel length of curve
         * @param Object    moving      x: True/Right, False/Left; y: True/Down, False/Up
         * @param Boolean   lineRender  Display line to canvas
         */
        addStraight: function(moving={x:true,y:true},lineRender=true){
            let self = this,
                lineArgs = {
                    x:moving.x,
                    y:moving.y
                };
            self.addPath(
                'straight',
                lineArgs,
                lineRender,
                true
            );
        },
        findPathLength: function(path) {
            let self = this,
                pathLength = 0;
                self.end = {x: path.lineArgs.x, y: path.lineArgs.y}
                path.length.start = self.pathLength;
            switch(path.lineType){
                case 'straight':
                case 'lineTo':
                    path.length.total = self.getLineLength(path.point.x,path.point.y,path.lineArgs);
                    break;
                case 'curve':
                case 'quadraticCurveTo':
                    path.length.total = self.getQuadraticBezierLength(
                        {x: path.point.x, y: path.point.y},
                        {x: path.lineArgs.controlPointX, y: path.lineArgs.controlPointY},
                        {x: path.lineArgs.x, y: path.lineArgs.y}
                    );
                    break;
                case 'compoundCurve':
                case 'bezierCurveTo':
                    path.length.total = self.getCubicBezierLength(
                        {x: path.point.x, y: path.point.y},
                        {x: path.lineArgs.controlPointX1, y: path.lineArgs.controlPointY1},
                        {x: path.lineArgs.controlPointX2, y: path.lineArgs.controlPointY2},
                        {x: path.lineArgs.x, y: path.lineArgs.y}
                    );
                    break;
            }
            path.length.end = (self.pathLength += path.length.total);
        },
        findPathSegmentsPrecentage: function() {
            let self = this,
                currentPercentage = 0;
            for(let pathIndex in self.paths) {
                let path = self.paths[pathIndex];
                    path.percentage.start   = currentPercentage;
                    path.percentage.total   = path.length.total / self.pathLength;
                    path.percentage.end     = currentPercentage + path.percentage.total;
                    currentPercentage       += path.percentage.total;
            }
            return;
        },
        renderLine: function(path) {
            self.ctx.beginPath();
            self.ctx.moveTo(path.point.x, path.point.y);
            self.pathRouting(path.lineType,path.lineArgs);
            self.ctx.strokeStyle = '#FFFFFF';
            self.ctx.stroke();
        },
        renderLines: function(path) {
            let self = this;
            for(let pathIndex in self.paths) {
                let path = self.paths[pathIndex];
                if(path.lineRender){self.renderLine(path);}
            }
        },
        createLines: function() {
            let self = this;
                self.ctx.lineWidth = 2;
                self.current = {
                    x:self.start.x,
                    y:self.start.y
                };
                self.pathLength = 0;

            for(let pathIndex in self.paths) {
                let path = self.paths[pathIndex];
                    path.point = {x:self.current.x,y:self.current.y};

                if(path.calucate) {
                    if(typeof path.lineArgs.controlPointX != 'undefined') {
                        path.lineArgs.controlPointX = self.current.x + (self.direction.xTravel > self.direction.yTravel ? path.lineArgs.controlPointX : 0);
                        path.lineArgs.controlPointY = self.current.y + (self.direction.xTravel < self.direction.yTravel ? path.lineArgs.controlPointY : 0);
                    }
                    path.lineArgs.x = self.current.x + path.lineArgs.x;
                    path.lineArgs.y = self.current.y + path.lineArgs.y;
                }
                self.findPathLength(path);
                    self.direction = {
                        x:self.current.x < path.lineArgs.x, // Moving Right?
                        y:self.current.y < path.lineArgs.y,  // Moving Down?
                        xTravel:Math.abs(self.current.x - path.lineArgs.x),
                        yTravel:Math.abs(self.current.y - path.lineArgs.y)
                    }
                self.current.x = path.lineArgs.x;
                self.current.y = path.lineArgs.y;
            }
            self.findPathSegmentsPrecentage();
        },
        pathRouting: function(lineType,lineArgs){
            switch(lineType){
                case 'straight':
                case 'lineTo':
                    self.ctx.lineTo(
                        lineArgs.x,
                        lineArgs.y
                    );
                    break;
                case 'curve':
                case 'quadraticCurveTo':
                    self.ctx.quadraticCurveTo(
                        lineArgs.controlPointX,
                        lineArgs.controlPointY,
                        lineArgs.x,
                        lineArgs.y
                    );
                    break;
                case 'compoundCurve':
                case 'bezierCurveTo':
                    self.ctx.bezierCurveTo(
                        lineArgs.controlPointX1,
                        lineArgs.controlPointY1,
                        lineArgs.controlPointX2,
                        lineArgs.controlPointY2,
                        lineArgs.x,
                        lineArgs.y
                    );
                    break;
            }
        },
        pathPositionRouting: function(path,travel){
            let coordinates = {x:0,y:0};
            switch(path.lineType){
                case 'straight':
                case 'lineTo':
                    coordinates = self.getLineXYatPercent(
                        {x: path.point.x, y: path.point.y},
                        {x: path.lineArgs.x, y: path.lineArgs.y},
                        travel
                    );
                    break;
                case 'curve':
                case 'quadraticCurveTo':
                    coordinates = self.getQuadraticBezierXYatPercent(
                        {x: path.point.x, y: path.point.y},
                        {x: path.lineArgs.controlPointX, y: path.lineArgs.controlPointY},
                        {x: path.lineArgs.x, y: path.lineArgs.y},
                        travel
                    );
                    break;
                case 'compoundCurve':
                case 'bezierCurveTo':
                    coordinates = self.getCubicBezierXYatPercent(
                        {x: path.point.x, y: path.point.y},
                        {x: path.lineArgs.controlPointX1, y: path.lineArgs.controlPointY1},
                        {x: path.lineArgs.controlPointX2, y: path.lineArgs.controlPointY2},
                        {x: path.lineArgs.x, y: path.lineArgs.y},
                        travel
                    );
                    break;
            }
            return coordinates;
        },

        getLineLength: function(startingX,startingY,lineArgs) {
            const lengthX = startingX > lineArgs.x ? startingX - lineArgs.x : lineArgs.x - startingX;
            const lengthY = startingY > lineArgs.y ? startingY - lineArgs.y : lineArgs.y - startingY;
            return Math.sqrt(Math.pow(lengthX,2) + Math.pow(lengthY,2));
        },
        getLineXYatPercent: function(startPt, endPt, percent) {
            const dx = endPt.x - startPt.x;
            const dy = endPt.y - startPt.y;
            const X = startPt.x + dx * percent;
            const Y = startPt.y + dy * percent;
            return ({
                x: X,
                y: Y
            });
        },

        getQuadraticBezierLength: function(startPt, controlPt, endPt) {
            const ax = startPt.x - 2 * controlPt.x + endPt.x;
            const ay = startPt.y - 2 * controlPt.y + endPt.y;
            const bx = 2 * controlPt.x - 2 * startPt.x;
            const by = 2 * controlPt.y - 2 * startPt.y;
            const A = 4 * (ax * ax + ay * ay);
            const B = 4 * (ax * bx + ay * by);
            const C = bx * bx + by * by;

            const Sabc = 2 * Math.sqrt(A+B+C);
            const A_2 = Math.sqrt(A);
            const A_32 = 2 * A * A_2;
            const C_2 = 2 * Math.sqrt(C);
            const BA = B / A_2;

            return (A_32 * Sabc + A_2 * B * (Sabc - C_2) + (4 * C * A - B * B) * Math.log((2 * A_2 + BA + Sabc) / (BA + C_2))) / (4 * A_32);
        },
        getQuadraticBezierXYatPercent: function(startPt, controlPt, endPt, percent) {
            const x = Math.pow(1 - percent, 2) * startPt.x + 2 * (1 - percent) * percent * controlPt.x + Math.pow(percent, 2) * endPt.x;
            const y = Math.pow(1 - percent, 2) * startPt.y + 2 * (1 - percent) * percent * controlPt.y + Math.pow(percent, 2) * endPt.y;
            return ({
                x: x,
                y: y
            });
        },

        getCubicBezierLength: function(startPt, controlPt1, controlPt2, endPt) {
            const self = this;
            let arcLengths = [];
                arcLengths[0] = 0;

            let ox = self.CubicN(0,startPt.x, controlPt1.x, controlPt2.x, endPt.x),
                oy = self.CubicN(0, startPt.y, controlPt1.y, controlPt2.y, endPt.y),
                clen = 0;
            for(let i = 1; i <= self.segmentLength; i += 1) {
                let x = self.CubicN(i * 0.05, startPt.x, controlPt1.x, controlPt2.x, endPt.x),
                    y = self.CubicN(i * 0.05, startPt.y, controlPt1.y, controlPt2.y, endPt.y);
                let dx = ox - x,
                    dy = oy - y;        
                clen += Math.sqrt(dx * dx + dy * dy);
                arcLengths[i] = clen;
                ox = x, oy = y;
            }
            return clen;
        },
        getCubicBezierXYatPercent: function(startPt, controlPt1, controlPt2, endPt, percent) {
            const self = this;
            const x = self.CubicN(percent, startPt.x, controlPt1.x, controlPt2.x, endPt.x);
            const y = self.CubicN(percent, startPt.y, controlPt1.y, controlPt2.y, endPt.y);
            return ({
                x: x,
                y: y
            });
        },
        CubicN: function(pct, a, b, c, d) {
            const t2 = pct * pct;
            const t3 = t2 * pct;
            return a + (-a * 3 + pct * (3 * a - a * pct)) * pct + (3 * b + pct * (-6 * b + b * 3 * pct)) * pct + (c * 3 - c * 3 * pct) * t2 + d * t3;
        }

    }

    return self;
}

//requestAnimationFrame();
let gameControl = function(canvas,ctx) {
    let self = {
        canvas: canvas,
        ctx: ctx,
        pathControl: pathControl(canvas,ctx),
        entity: entityControl(canvas,ctx),
        mouse: {x:0,y:0},
        loop:null,
        gameTick:0,
        gameTickSpeed:500,
        fps:120,
        init: function() {
            let self = this;
            self.buildLevel(3);
            self.animation();
            self.loop = setInterval(function() {
                self.resetGameTick();
                if(self.gameTick%Math.ceil(1000/self.fps) == 0){
                    self.animation();
                }
                if(self.gameTick%Math.ceil(1000/self.gameTickSpeed) == 0){
                self.updateEntities();
                }
                ++self.gameTick;
                console.log(self.gameTick);
            }, 1);

            self.canvas.addEventListener("mousemove", function (evt) {
                self.mouse = self.getMousePos(evt);
            }, false);
        },
        buildLevel: function(level=1) {
            let self = this;
            if(typeof self['level'+level] == 'function'){
                self['level'+level]();
            }else{
                console.warn('No Level Data Found')
            }

            self.pathControl.createLines(); 
            self.generateEntities(); 
        },
        level1: function() {
            let self = this;
            self.pathControl.startPath(100,20);

            self.pathControl.addPath('lineTo',{x:200,y:160});
            self.pathControl.addPath('quadraticCurveTo',{
                controlPointX:230,
                controlPointY:200,
                x:250,
                y:150
            });
            self.pathControl.addPath('bezierCurveTo',{
                controlPointX1:290,
                controlPointY1:-40,
                controlPointX2:300,
                controlPointY2:200,
                x:400,
                y:150
            });
            self.pathControl.addPath('lineTo',{x:500,y:90});
        },
        level2: function() {
            let self = this;
            self.pathControl.startPath(10,10);

            self.pathControl.addPath('lineTo',{x:10,y:300});
            self.pathControl.addRightAngleCurve();
            self.pathControl.addPath('lineTo',{x:300,y:310});
            self.pathControl.addRightAngleCurve(10,moving={x:true,y:false});
            self.pathControl.addPath('lineTo',{x:310,y:20});
            self.pathControl.addRightAngleCurve(10,moving={x:false,y:false});
            self.pathControl.addPath('lineTo',{x:160,y:10});
            self.pathControl.addRightAngleCurve(10,moving={x:false,y:true});

            self.pathControl.addPath('lineTo',{x:150,y:160});
            self.pathControl.addRightAngleCurve();
            self.pathControl.addPath('lineTo',{x:225,y:170});
            self.pathControl.addRightAngleCurve(10,moving={x:true,y:false});
            self.pathControl.addPath('lineTo',{x:235,y:100});
            self.pathControl.addRightAngleCurve(10,moving={x:false,y:false});
        },
        level3: function() {
            let self = this;
            self.pathControl.startPath(10,150);

            self.pathControl.addStraight({x:200,y:0});
            self.pathControl.addRightAngleCurve(10,moving={x:true,y:false});
            self.pathControl.addStraight({x:0,y:-50});
            self.pathControl.addRightAngleCurve(10,moving={x:false,y:false});
            self.pathControl.addStraight({x:-50,y:0});
            self.pathControl.addRightAngleCurve(10,moving={x:false,y:true});
            self.pathControl.addStraight({x:0,y:120});
            self.pathControl.addRightAngleCurve(10,moving={x:true,y:true});
            self.pathControl.addStraight({x:50,y:0});
            self.pathControl.addRightAngleCurve(10,moving={x:true,y:false});
            self.pathControl.addStraight({x:0,y:-50});
            self.pathControl.addRightAngleCurve(10,moving={x:true,y:false});
            self.pathControl.addStraight({x:50,y:0});
            self.pathControl.addRightAngleCurve(10,moving={x:true,y:true});
            self.pathControl.addStraight({x:0,y:50});
            self.pathControl.addRightAngleCurve(10,moving={x:false,y:true});
            self.pathControl.addStraight({x:-50,y:0});
            self.pathControl.addRightAngleCurve(10,moving={x:false,y:true});
            self.pathControl.addStraight({x:0,y:150});
        },
        generateEntities: function(){
            self.entity.addEnity('tower','basic',{position:{x:200,y:200},color:{r:0,g:255,b:255},radius:10,attackRadius:30,attack:{rate:200,power:.3}});
            self.entity.addEnity('tower','basic',{position:{x:130,y:120},color:{r:0,g:255,b:255},radius:10,attackRadius:30,attack:{rate:200,power:.3}});
            self.entity.addEnity('enemy','basic',{speed:.1,travel:0,color:{r:255,g:0,b:0},health:1});
            self.entity.addEnity('enemy','basic',{speed:.15,travel:-.2,color:{r:155,g:0,b:0},health:1});
            self.entity.addEnity('enemy','basic',{speed:.1,travel:-.3,color:{r:255,g:0,b:0},health:1});
            self.entity.addEnity('enemy','basic',{speed:.1,travel:-.4,color:{r:255,g:0,b:0},health:1});
            self.entity.addEnity('enemy','basic',{speed:.1,travel:-.6,color:{r:255,g:0,b:0},health:1});
            self.entity.addEnity('enemy','basic',{speed:.1,travel:-.7,color:{r:255,g:0,b:0},health:1});
            self.entity.addEnity('enemy','basic',{speed:.1,travel:-.8,color:{r:255,g:0,b:0},health:1});
            self.entity.addEnity('enemy','basic',{speed:.105,travel:-1,color:{r:0,g:0,b:255},health:1});
            self.entity.addEnity('enemy','basic',{speed:.105,travel:-1.5,color:{r:0,g:0,b:255},health:1});
            self.entity.addEnity('enemy','basic',{speed:.105,travel:-2,color:{r:0,g:0,b:255},health:1});
            self.entity.addEnity('enemy','basic',{speed:.105,travel:-2.5,color:{r:0,g:0,b:255},health:1});
            self.entity.addEnity('enemy','basic',{speed:.105,travel:-3,color:{r:0,g:0,b:255},health:1});
            self.entity.addEnity('enemy','basic',{speed:.105,travel:-3.5,color:{r:0,g:0,b:255},health:1});
        },
        resetCanvas: function(){
            self.ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
        },
        updateEntities: function(){
            let self = this;
            for(let entityIndex in self.entity.entities.enemy) {
                let entity = self.entity.entities.enemy[entityIndex];
                self.updateEnemies(entity,entityIndex);
            }
            for(let entityIndex in self.entity.entities.tower) {
                let entity = self.entity.entities.tower[entityIndex];
                self.updateTowers(entity,entityIndex);
            }
        },
        updateEnemies: function(entity,index){
            let self = this;
            if(entity.position.x < 0 && entity.position.y < 0){
                entity.position.x = self.pathControl.start.x;
                entity.position.y = self.pathControl.start.y;
                return;
            };

            if(entity.trace){console.log(entity)}

            if(entity.travel > 1 || entity.health <= 0){
                self.entity.removeEntity(index);
                return;
            };
            entity.travel += entity.speed;
            for(let pathIndex in self.pathControl.paths) {
                let path = self.pathControl.paths[pathIndex];
                if(entity.travel >= path.percentage.start && entity.travel < path.percentage.end) {
                    let segmentTravel   = entity.travel - path.percentage.start,
                        segmentPercent  = segmentTravel / path.percentage.total;
                        entity.position = self.pathControl.pathPositionRouting(path,segmentPercent);
                    break;
                }
            }
        },
        updateTowers: function(tower,index){
            let self = this;

            let circle1 = {radius: tower.influence.attackRadius, x: tower.position.x, y: tower.position.y};

            for(let entityIndex in self.entity.entities.enemy) {
                let enemy = self.entity.entities.enemy[entityIndex];
                let circle2 = {radius: enemy.influence.attackRadius, x: enemy.position.x, y: enemy.position.y};

                tower.health=1;
                if(tower.attack.coolDown == 0) {
                    if(self.radialCollision(circle1, circle2)){
                        tower.health=.5;

                        enemy.health -= tower.attack.power;
                        tower.attack.coolDown = tower.attack.rate;
                        break;
                    }
                }
                if(tower.attack.coolDown > 0){
                    tower.attack.coolDown = tower.attack.coolDown - 1;
                }
            }
            return;
        },
        radialCollision: function(circle1={radius:0,x:0,y:0}, circle2={radius:0,x:0,y:0}) {

            var dx = circle1.x - circle2.x;
            var dy = circle1.y - circle2.y;
            var distance = Math.sqrt(dx * dx + dy * dy);

            return distance < circle1.radius + circle2.radius
        },
        animation: function() {
            let self = this;
                self.resetCanvas();
                self.pathControl.renderLines();
                self.entity.draw();

            self.ctx.strokeStyle = "rgba(4,255,255,0.2)";
            ctx.beginPath();
            ctx.moveTo(0, self.mouse.y);
            ctx.lineTo(self.mouse.x*self.canvas.width, self.mouse.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(self.mouse.x, 0);
            ctx.lineTo(self.mouse.x, self.mouse.y+self.canvas.height);
            ctx.stroke();
        },
        getMousePos: function(evt) {
            var rect = self.canvas.getBoundingClientRect();
            return {
                x: evt.clientX - rect.left,
                y: evt.clientY - rect.top
            };
        },
        resetGameTick: function(){
            let self = this;
            if(self.gameTick == self.lcm(self.fps,self.gameTickSpeed || self.gameTick > 10000)){
                self.gameTick = 0;
            }
        },
        lcm: function(x, y) {
            let self = this;
            if ((typeof x !== 'number') || (typeof y !== 'number')) {return false;}
            return (!x || !y) ? 0 : Math.abs((x * y) / self.gcd(x, y));
        },
        gcd: function(x, y) {
            x = Math.abs(x);
            y = Math.abs(y);
            while(y) {
                var t = y;
                y = x % y;
                x = t;
            }
            return x;
        }

    };
    return self;
};


let controller = gameControl(canvas,ctx);
controller.init();