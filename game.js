'use strict';


class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    plus(vector) {
        if (!(vector instanceof Vector)) {
            throw new Error('Можно прибавлять к вектору только объект типа Vector');
        }
        return new Vector(this.x + vector.x, this.y + vector.y);
    }

    times(time)  {
        return new Vector(this.x * time, this.y * time);
    }
}


class Actor {
    constructor(pos = new Vector(0, 0), size = new Vector(1, 1), speed = new Vector(0, 0)) {
        if ((!(pos instanceof Vector) || !(size instanceof Vector) || !(speed instanceof Vector)))  {
            throw new Error('Передаваемые парметры должны быть типа Vector')
        }

        this.pos = pos;
        this.size = size;
        this.speed = speed;
    }

    act()  {}

    get type()  {
        return 'actor';
    }

    get left()  {
        return this.pos.x;
    }

    get right() {
        return this.pos.x + this.size.x;
    }

    get top()  {
        return this.pos.y;
    }

    get bottom() {
        return this.pos.y + this.size.y;
    }

    isIntersect(someActor) {
        if (!someActor || !(someActor instanceof Actor)) {
            throw new Error('Можно передать только объект типа Vector');
        }

        if (this === someActor) {
            return false;
        }
        return this.left < someActor.right &&
        this.right > someActor.left &&
        this.top < someActor.bottom &&
        this.bottom > someActor.top
    }
}


class Level  {
    constructor (grid = [], actors = []) {
        this.grid = grid;
        this.actors = actors;
        this.player = actors.find(actor => actor.type === 'player');
        this.height = grid.length;
        this.width = grid.reduce((previous, current) => Math.max(previous, current.length), 0);
        this.status = null;
        this.finishDelay = 1;

    }

    isFinished()  {
        return this.status !== null && this.finishDelay < 0;
    }

    actorAt(actor)  {
        if (!(actor instanceof Actor))  {
            throw new Error('Тип объекта не Actor, или объект не задан');
        }
        return this.actors.find(someActor => actor.isIntersect(someActor));
    }


    obstacleAt(pos, size)  {
        if(!(pos instanceof Vector) || !(size instanceof Vector)) {
            throw new Error('Переданные объекты не относяться к типу Vector');
        }

        const leftBorder = Math.floor(pos.x);
        const rightBorder = Math.ceil(pos.x + size.x);
        const topBorder = Math.floor(pos.y);
        const bottomBorder = Math.ceil(pos.y + size.y);

        if (leftBorder < 0 || rightBorder > this.width || topBorder < 0) {
            return 'wall';
        }

        if (bottomBorder > this.height) {
            return 'lava';
        }

        for (let y = topBorder; y < bottomBorder; y++) {
            for (let x = leftBorder; x < rightBorder; x++) {
            const obstacle = this.grid[y][x];
                if (obstacle) {
                    return obstacle;
                }
            }
        }
    }

    removeActor(actor)  {
        const index = this.actors.indexOf(actor);
        if (index != -1)  {
          this.actors.splice(index, 1);
        }
    }

    noMoreActors(type) {
        return !this.actors.some(actor => actor.type === type);
    }

    playerTouched(touchedType, actor)  {
        if (this.status !== null) {
            return;
        }

        if (['lava', 'fireball'].some((el) => el === touchedType)) {
            this.status = 'lost';
        }

        if (touchedType === 'coin' && actor.type === 'coin') {
            this.removeActor(actor);
            if (this.noMoreActors('coin')) {
                this.status = 'won';
            }
        }
    }
}


class LevelParser {
    constructor(dictActors = {}) {
        this.itemsField = dictActors;

        this.obstacles = {
            'x' : 'wall',
            '!' : 'lava'
        }
    }

    actorFromSymbol(item) {
        return this.itemsField[item];
    }

    obstacleFromSymbol(item)  {
        return this.obstacles[item];
    }

    createGrid(field = [])  {
        return field.map(elementY => elementY.split('').map(elementX => this.obstacleFromSymbol(elementX)));
    }

    createActors(movieField = [])  {
        const items = [];

        movieField.forEach((itemY, y) => {
            itemY.split('').forEach((itemX, x) => {
                const Constructor = this.actorFromSymbol(itemX)
                if (typeof Constructor === 'function')  {
                    const result = new Constructor(new Vector(x, y));
                    if (result instanceof Actor)  {
                        items.push(result);
                    }
                }
            });
        });

        return items;
    }

    parse(field) {
        const grid = this.createGrid(field);
        const actors = this.createActors(field);
        return new Level(grid, actors);
    }
}


class Fireball extends Actor {
    constructor(pos = new Vector(0, 0), speed = new Vector(0, 0)){
        super(pos, new Vector(1, 1), speed);
    }

    get type()  {
        return 'fireball';
    }

    getNextPosition(time = 1) {
        return this.pos.plus(this.speed.times(time));
    }

    handleObstacle()  {
        this.speed = this.speed.times(-1);
    }

    act(time, lvl) {
        const nextPosition = this.getNextPosition(time);
        if (lvl.obstacleAt(nextPosition, this.size))  {
            this.handleObstacle();
        } else {
            this.pos = nextPosition;
        }
    }
}


class HorizontalFireball extends Fireball {
    constructor(pos) {
        super(pos, new Vector(2, 0));
    }
}


class VerticalFireball extends Fireball {
    constructor(pos) {
        super(pos, new Vector(0, 2));
    }
}


class FireRain extends Fireball {
    constructor(pos) {
        super(pos, new Vector(0, 3));
        this.starPosition = pos;
    }

    handleObstacle()  {
        this.pos = this.starPosition;
    }
}


class Coin extends Actor {
    constructor(pos) {
        super(pos, new Vector(0.6, 0.6));
        this.pos = this.pos.plus(new Vector(0.2, 0.1));
        this.startPos = this.pos;
        this.spring = Math.random() * (Math.PI * 2);
        this.springDist = 0.07;
        this.springSpeed = 8;
    }

    get type()  {
        return 'coin';
    }

    updateSpring(time = 1)  {
        this.spring += this.springSpeed * time;
    }

    getSpringVector() {
        return new Vector(0, (Math.sin(this.spring) * this.springDist));
    }

    getNextPosition(time = 1) {
        this.updateSpring(time);
        return this.startPos.plus(this.getSpringVector());
    }

    act(time) {
        this.pos = this.getNextPosition(time);
    }
}


class Player extends Actor  {
    constructor(pos) {
        super(pos, new Vector(0.8, 1.5));
        this.pos = this.pos.plus(new Vector(0, -0.5));
    }

    get type()  {
        return 'player';
    }
}


const actorDict = {
    '@': Player,
    'v': FireRain,
    'o': Coin,
    '=': HorizontalFireball,
    '|': VerticalFireball
};

const parser = new LevelParser(actorDict);

loadLevels()
    .then((res) => {runGame(JSON.parse(res), parser, DOMDisplay)
        .then(() => alert('Вы выиграли!'))
    });
