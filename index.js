const axios = require("axios").default;
const fs = require("fs");
const kebabCase = require("lodash/kebabCase");
const path = require("path");

(async () => {
  const data = (await axios.get("https://stickers.zaloapp.com/sticker")).data;

  let result = data.value.all.map(({ name, thumbImg, iconUrl, id }) => ({
    name,
    thumbnail: thumbImg,
    icon: iconUrl,
    stickerId: id,
    id: kebabCase(
      name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
    ),
  }));

  result = await Promise.all(
    result.map(async (item) => {
      const collectionData = (
        await axios.get(`https://stickers.zaloapp.com/cate-stickers`, {
          params: {
            cid: item.stickerId,
          },
        })
      ).data.value.map((sticker) => {
        const eid = new URLSearchParams(new URL(sticker.url).search).get("eid");
        const sprite =
          eid.length > 3
            ? `https://zalo-api.zadn.vn/api/emoticon/sprite?eid=${eid}&size=130&checksum=ce5b95009fb86ddc268a233f550f6e48`
            : `https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=${eid}&size=130&version=3`;
        return {
          id: eid,
          sprite,
        };
      });

      delete item.stickerId;

      return {
        ...item,
        stickers: collectionData,
      };
    })
  );

  let downloaded = 0;

  result.forEach((item) => {
    fs.mkdirSync(path.join(__dirname, "data", "images", item.id), {
      recursive: true,
    });
    item.stickers.forEach((sticker) => {
      const imgPath = path.join(
        __dirname,
        "data",
        "images",
        item.id,
        `${sticker.id}.png`
      );
      if (!fs.existsSync(imgPath))
        axios
          .get(sticker.sprite, { responseType: "arraybuffer" })
          .then((res) => {
            fs.writeFileSync(imgPath, res.data);
            downloaded++;
            console.log("Downloaded: ", downloaded);
          })
          .catch((err) => {
            console.log(err.message, sticker.sprite);
          });
    });
  });

  let final = result.map(
    ({ name, thumbnail, icon, stickerId, id, stickers }) => ({
      name,
      thumbnail,
      icon,
      stickerId,
      id,
      stickers: stickers.map(({ id: stickerId }) => {
        const spriteURL = `https://cdn.jsdelivr.net/gh/naptestdev/zalo-stickers/data/images/${id}/${stickerId}.png`;
        return {
          id: stickerId,
          spriteURL,
          iframe: `https://sprite.napdev.workers.dev/?url=${encodeURIComponent(
            spriteURL
          )}`,
        };
      }),
    })
  );

  fs.writeFileSync("data/list.json", JSON.stringify(final, null, 2), {
    encoding: "utf-8",
  });
})();
