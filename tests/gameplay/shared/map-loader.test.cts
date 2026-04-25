const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadMapDefinitionFromCsv } = require("../../../shared/map-loader.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function withCsvFile(content: string, run: (filePath: string) => void) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-map-loader-"));
  const filePath = path.join(directory, "map.csv");
  fs.writeFileSync(filePath, content, "utf8");

  try {
    run(filePath);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

register(
  "loadMapDefinitionFromCsv parses a valid CSV with trimming, comments, and empty neighbors",
  () => {
    withCsvFile(
      [
        "# comment",
        " id , name , continentId , x , y , neighbors ",
        " alpha , Alpha , north , 0.10 , 0.20 , beta ",
        " beta , Beta , north , 0.30 , 0.40 , alpha ",
        " gamma , Gamma , south , 0.50 , 0.60 , "
      ].join("\n"),
      (filePath) => {
        const map = loadMapDefinitionFromCsv(filePath);

        assert.equal(map.source, path.resolve(filePath));
        assert.deepEqual(
          map.territories.map((entry: any) => entry.territory.id),
          ["alpha", "beta", "gamma"]
        );
        assert.deepEqual(map.territories[0].territory.neighbors, ["beta"]);
        assert.deepEqual(map.territories[2].territory.neighbors, []);
        assert.deepEqual(map.positions.alpha, { x: 0.1, y: 0.2 });
        assert.deepEqual(map.positions.gamma, { x: 0.5, y: 0.6 });
      }
    );
  }
);

register("loadMapDefinitionFromCsv rejects CSV files with missing headers", () => {
  withCsvFile(["id,name,continentId,x,y", "alpha,Alpha,north,0.1,0.2"].join("\n"), (filePath) => {
    assert.throws(() => loadMapDefinitionFromCsv(filePath), /missing required headers: neighbors/i);
  });
});

register("loadMapDefinitionFromCsv rejects header-only CSV files", () => {
  withCsvFile("id,name,continentId,x,y,neighbors", (filePath) => {
    assert.throws(() => loadMapDefinitionFromCsv(filePath), /at least one territory row/i);
  });
});

register("loadMapDefinitionFromCsv rejects rows that do not match header length", () => {
  withCsvFile(
    ["id,name,continentId,x,y,neighbors", "alpha,Alpha,north,0.1,0.2"].join("\n"),
    (filePath) => {
      assert.throws(
        () => loadMapDefinitionFromCsv(filePath),
        /does not match the CSV header length/i
      );
    }
  );
});

register("loadMapDefinitionFromCsv rejects non-numeric coordinates", () => {
  withCsvFile(
    ["id,name,continentId,x,y,neighbors", "alpha,Alpha,north,nope,0.2,"].join("\n"),
    (filePath) => {
      assert.throws(() => loadMapDefinitionFromCsv(filePath), /invalid x coordinate/i);
    }
  );
});

register("loadMapDefinitionFromCsv rejects out-of-range coordinates", () => {
  withCsvFile(
    ["id,name,continentId,x,y,neighbors", "alpha,Alpha,north,1.2,0.2,"].join("\n"),
    (filePath) => {
      assert.throws(() => loadMapDefinitionFromCsv(filePath), /between 0 and 1/i);
    }
  );
});

register("loadMapDefinitionFromCsv rejects rows without territory id", () => {
  withCsvFile(
    ["id,name,continentId,x,y,neighbors", ",Alpha,north,0.1,0.2,"].join("\n"),
    (filePath) => {
      assert.throws(() => loadMapDefinitionFromCsv(filePath), /missing territory id/i);
    }
  );
});

register("loadMapDefinitionFromCsv rejects rows without territory name", () => {
  withCsvFile(
    ["id,name,continentId,x,y,neighbors", "alpha,,north,0.1,0.2,"].join("\n"),
    (filePath) => {
      assert.throws(() => loadMapDefinitionFromCsv(filePath), /missing a name/i);
    }
  );
});

register("loadMapDefinitionFromCsv rejects duplicate territory ids", () => {
  withCsvFile(
    [
      "id,name,continentId,x,y,neighbors",
      "alpha,Alpha,north,0.1,0.2,beta",
      "alpha,Alpha 2,north,0.3,0.4,beta"
    ].join("\n"),
    (filePath) => {
      assert.throws(() => loadMapDefinitionFromCsv(filePath), /Duplicate territory id "alpha"/i);
    }
  );
});

register("loadMapDefinitionFromCsv rejects unknown neighbors", () => {
  withCsvFile(
    ["id,name,continentId,x,y,neighbors", "alpha,Alpha,north,0.1,0.2,missing"].join("\n"),
    (filePath) => {
      assert.throws(() => loadMapDefinitionFromCsv(filePath), /unknown neighbor "missing"/i);
    }
  );
});

register("loadMapDefinitionFromCsv rejects non-bidirectional adjacency", () => {
  withCsvFile(
    [
      "id,name,continentId,x,y,neighbors",
      "alpha,Alpha,north,0.1,0.2,beta",
      "beta,Beta,north,0.3,0.4,"
    ].join("\n"),
    (filePath) => {
      assert.throws(() => loadMapDefinitionFromCsv(filePath), /must be bidirectional/i);
    }
  );
});
