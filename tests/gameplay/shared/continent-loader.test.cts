const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadContinentsFromCsv } = require("../../../shared/continent-loader.cjs");

declare function register(name: string, fn: () => void | Promise<void>): void;

function withCsvFile(content: string, run: (filePath: string) => void) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "netrisk-continent-loader-"));
  const filePath = path.join(directory, "continents.csv");
  fs.writeFileSync(filePath, content, "utf8");

  try {
    run(filePath);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

register("loadContinentsFromCsv parses a valid CSV with trimming and empty territory lists", () => {
  withCsvFile(
    [
      "# comment",
      " id , name , bonus , territoryIds ",
      " north , North , 5 , alpha | beta ",
      " islands , Islands , 2 , "
    ].join("\n"),
    (filePath) => {
      const continents = loadContinentsFromCsv(filePath, { validTerritoryIds: ["alpha", "beta"] });

      assert.equal(continents.source, path.resolve(filePath));
      assert.deepEqual(
        continents.continents.map((continent: any) => continent.id),
        ["north", "islands"]
      );
      assert.deepEqual(continents.continents[0].territoryIds, ["alpha", "beta"]);
      assert.deepEqual(continents.continents[1].territoryIds, []);
      assert.equal(continents.continents[0].bonus, 5);
    }
  );
});

register("loadContinentsFromCsv rejects CSV files with missing headers", () => {
  withCsvFile(["id,name,bonus", "north,North,5"].join("\n"), (filePath) => {
    assert.throws(() => loadContinentsFromCsv(filePath), /missing required headers: territoryIds/i);
  });
});

register("loadContinentsFromCsv rejects header-only CSV files", () => {
  withCsvFile("id,name,bonus,territoryIds", (filePath) => {
    assert.throws(() => loadContinentsFromCsv(filePath), /at least one continent row/i);
  });
});

register("loadContinentsFromCsv rejects invalid bonus values", () => {
  withCsvFile(["id,name,bonus,territoryIds", "north,North,nope,alpha"].join("\n"), (filePath) => {
    assert.throws(() => loadContinentsFromCsv(filePath), /invalid bonus value/i);
  });
});

register("loadContinentsFromCsv rejects rows without continent id", () => {
  withCsvFile(["id,name,bonus,territoryIds", ",North,5,alpha"].join("\n"), (filePath) => {
    assert.throws(() => loadContinentsFromCsv(filePath), /missing continent id/i);
  });
});

register("loadContinentsFromCsv rejects rows without continent name", () => {
  withCsvFile(["id,name,bonus,territoryIds", "north,,5,alpha"].join("\n"), (filePath) => {
    assert.throws(() => loadContinentsFromCsv(filePath), /missing a name/i);
  });
});

register("loadContinentsFromCsv rejects duplicate continent ids", () => {
  withCsvFile(
    ["id,name,bonus,territoryIds", "north,North,5,alpha", "north,North 2,3,beta"].join("\n"),
    (filePath) => {
      assert.throws(() => loadContinentsFromCsv(filePath), /Duplicate continent id "north"/i);
    }
  );
});

register(
  "loadContinentsFromCsv rejects unknown territory references when a valid territory list is provided",
  () => {
    withCsvFile(["id,name,bonus,territoryIds", "north,North,5,missing"].join("\n"), (filePath) => {
      assert.throws(
        () => loadContinentsFromCsv(filePath, { validTerritoryIds: ["alpha", "beta"] }),
        /unknown territory "missing"/i
      );
    });
  }
);

register(
  "loadContinentsFromCsv allows territory references when no validation list is provided",
  () => {
    withCsvFile(["id,name,bonus,territoryIds", "north,North,5,missing"].join("\n"), (filePath) => {
      const continents = loadContinentsFromCsv(filePath);
      assert.deepEqual(continents.continents[0].territoryIds, ["missing"]);
    });
  }
);
