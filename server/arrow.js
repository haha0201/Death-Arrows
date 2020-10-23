module.exports = class Arrow {
  constructor(x, y, angle, speed, id, parent) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.xv = Math.cos(this.angle) * (speed * 1) * 20;
    this.yv = Math.sin(this.angle) * (speed * 1) * 20;
    this.life = 3;
    this.height = 23 * 2;
    this.width = 10 * 2;
    this.dead = false;
    this.id = id;
    this.parent = parent;
  }

  static getAllInitPack({ arrows }) {
    var initPacks = [];
    for (let i of Object.keys(arrows)) {
      initPacks.push(arrows[i].getInitPack());
    }
    return initPacks;
  }
  static pack({ arrows, removePack, platforms, delta }) {
    let pack = [];
    for (let i of Object.keys(arrows)) {
      for (let d = 0; d < 5; d++) {
        arrows[i].update(platforms, delta / 5);
      }
      if (arrows[i].dead) {
        removePack.arrow.push({ id: arrows[i].id, type: "wall" });
        delete arrows[i];
        // Arrow.onDisconnect({ id: i, arrows, removePack });
      } else {
        pack.push(arrows[i].getUpdatePack());
      }
    }
    return pack;
  }
  getUpdatePack() {
    return {
      id: this.id,
      x: this.x,
      y: this.y
    };
  }
  getInitPack() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      life: this.life,
      angle: this.angle,
      parent: this.parent
    };
  }
  update(platforms, delta) {
    this.x += this.xv * delta;
    this.y += this.yv * delta;
    this.life -= delta;
    if (this.life < 0) {
      this.dead = true;
    }
    /*
    x*cos(t) - y*sin(t)
    */
    /*
   function rotate(x, y, a)
  local c = math.cos(a)
  local s = math.sin(a)
  return c*x - s*y, s*x + c*y
  const [x,y] = [];
  */
    let c = Math.cos(this.angle);
    let s = Math.sin(this.angle);
    //const [x, y] = [c * this.x - s * this.y, s * this.x + c * this.y];
    // console.log(x - this.x);
    for (let platform of platforms) {
      if (
        doPolygonsIntersect(
          [
            { x: this.x, y: this.y },
            { x: this.x + this.width * c, y: this.y },
            { x: this.x + this.width * c, y: this.y + this.height * s },
            { x: this.x, y: this.y + s * this.height }
          ],
          [
            { x: platform.x, y: platform.y },
            { x: platform.x + platform.w, y: platform.y },
            { x: platform.x + platform.w, y: platform.y + platform.h },
            { x: platform.x, y: platform.y + platform.h }
          ]
        )
      ) {
        this.dead = true;
      }
    }
    /*console.log({
      x: this.x,
      y: this.y,
      xv: this.xv,
      yv: this.yv,
      life: this.life
    });*/
  }
};

function doPolygonsIntersect(a, b) {
  var polygons = [a, b];
  var minA, maxA, projected, i, i1, j, minB, maxB;

  for (i = 0; i < polygons.length; i++) {
    // for each polygon, look at each edge of the polygon, and determine if it separates
    // the two shapes
    var polygon = polygons[i];
    for (i1 = 0; i1 < polygon.length; i1++) {
      // grab 2 vertices to create an edge
      var i2 = (i1 + 1) % polygon.length;
      var p1 = polygon[i1];
      var p2 = polygon[i2];

      // find the line perpendicular to this edge
      var normal = { x: p2.y - p1.y, y: p1.x - p2.x };

      minA = maxA = undefined;
      // for each vertex in the first shape, project it onto the line perpendicular to the edge
      // and keep track of the min and max of these values
      for (j = 0; j < a.length; j++) {
        projected = normal.x * a[j].x + normal.y * a[j].y;
        if (minA === undefined || projected < minA) {
          minA = projected;
        }
        if (maxA === undefined || projected > maxA) {
          maxA = projected;
        }
      }

      // for each vertex in the second shape, project it onto the line perpendicular to the edge
      // and keep track of the min and max of these values
      minB = maxB = undefined;
      for (j = 0; j < b.length; j++) {
        projected = normal.x * b[j].x + normal.y * b[j].y;
        if (minB === undefined || projected < minB) {
          minB = projected;
        }
        if (maxB === undefined || projected > maxB) {
          maxB = projected;
        }
      }

      // if there is no overlap between the projects, the edge we are looking at separates the two
      // polygons, and we know there is no overlap
      if (maxA < minB || maxB < minA) {
        return false;
      }
    }
  }
  return true;
}
