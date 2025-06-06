const express = require('express');
const fs = require('fs').promises;
const fss = require('fs'); // Để dùng writeFileSync
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'css'))); // Thư mục css
app.use('/js', express.static(path.join(__dirname, 'js')));   // Thư mục js
app.use('/webfonts', express.static(path.join(__dirname, 'webfonts')));   // Thư mục fonts

// Class Person
class Person {
  constructor(id, name, title, gender, outsider, isalive = true, children = [], level = 0) {
    this.id = id || '';
    this.name = name || 'Unknown';
    this.title = title || '';
    this.gender = gender || '';
    this.outsider = outsider === 'true' || outsider === true;
    this.isalive = isalive === 'false' ? false : true;
    this.children = this.parseChildren(children);
    this.level = level;
  }

  parseChildren(children, childLevel) {
    if (!Array.isArray(children) || children.length === 0) return [];
    return children.map(childGroup => {
      return childGroup.map(child => {
        return new Person(
          child.id,
          child.name,
          child.title,
          child.gender,
          child.outsider,
          child.isalive,
          child.children || [],
          child.level !== undefined ? child.level : childLevel
        );
      });
    });
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      title: this.title,
      gender: this.gender,
      outsider: this.outsider ? 'true' : '',
      isalive: this.isalive ? '' : 'false',
      children: this.children.map(group => group.map(child => child.toJSON())),
      level: this.level
    };
  }
}

const jsonFilePath = path.join(__dirname, 'data.json');

// Hàm tìm Person theo id trong cây gia phả
function findPersonById(data, id) {
  for (let group of data) {
    for (let person of group) {
      if (person.id === id) return { person, parentGroup: group };
      for (let childGroup of person.children) {
        for (let child of childGroup) {
          if (child.id === id) return { person: child, parentGroup: childGroup, parent: person };
          const found = findPersonById(person.children, id);
          if (found.person) return found;
        }
      }
    }
  }
  return { person: null };
}

function findParentById(data, id) {
  for (let group of data) {
    for (let person of group) {
      for (let childGroup of person.children) {
        for (let child of childGroup) {
          if (child.id === id) {
            return { parent: person, parentGroup: group };
          }
          // Duyệt đệ quy vào children của child
          const found = findParentById(person.children, id);
          if (found.parent) {
            return found;
          }
        }
      }
    }
  }
  return { parent: null };
}

// Hàm tìm ID lớn nhất và tạo ID mới
function generateNextId(data) {
  let maxId = 0;
  function findMaxId(persons) {
    persons.forEach(group => {
      group.forEach(person => {
        const idNum = parseInt(person.id.replace('P', ''), 10);
        if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
        if (person.children && person.children.length > 0) {
          findMaxId(person.children);
        }
      });
    });
  }
  findMaxId(data);
  return `P${String(maxId + 1).padStart(3, '0')}`;
}

// API đọc dữ liệu gia phả
app.get('/api/data', async (req, res) => {
  try {
    const data = await fs.readFile(jsonFilePath, 'utf8');
    const jsonData = JSON.parse(data);
    const familyTree = parseFamilyTree(jsonData);
    res.json(familyTree.map(group => group.map(person => person.toJSON())));
  } catch (err) {
    res.status(500).json({ error: 'Không thể đọc file JSON', details: err.message });
  }
});

// API thêm Person mới
app.post('/api/add-person', async (req, res) => {
  try {
    const { newPerson, parentId, siblingId, childId } = req.body;

    const data = await fs.readFile(jsonFilePath, 'utf8');
    let jsonData = JSON.parse(data);
    const familyTree = parseFamilyTree(jsonData);

    // Tính level cho người mới
    let newLevel = 0;
    if (parentId) {
      const { person: parent } = findPersonById(familyTree, parentId);
      if (!parent) {
        return res.status(404).json({ error: 'Không tìm thấy cha/mẹ với ID này' });
      }
      newLevel = parent.level + 1;
    } else if (siblingId) {
      const { person: sibling, parent } = findPersonById(familyTree, siblingId);
      if (!sibling || !parent) {
        return res.status(404).json({ error: 'Không tìm thấy anh/chị/em với ID này' });
      }
      newLevel = sibling.level;
    } else if (childId) {
      const { person: child } = findPersonById(familyTree, childId);
      if (!child) {
        return res.status(404).json({ error: 'Không tìm thấy con với ID này' });
      }
      newLevel = child.level > 0 ? child.level - 1 : 0; // Cha mới có level nhỏ hơn con, tối thiểu 0
    }
    const newid = generateNextId(familyTree);
    // Tạo người mới với level
    const newPersonInstance = new Person(
      newid,
      newPerson.name,
      newPerson.title,
      newPerson.gender,
      newPerson.outsider,
      newPerson.isalive,
      [], // Sẽ thêm children nếu có childId
      newLevel
    );

    if (parentId) {
      const { person: parent } = findPersonById(familyTree, parentId);
      parent.children.push([newPersonInstance]);
    } else if (siblingId) {
      const { person: sibling, parent } = findPersonById(familyTree, siblingId);
      if (newPerson.outsider === 'true') {
        for (let group of parent.children) {
          if (group.includes(sibling)) {
            group.push(newPersonInstance);
            break;
          }
        }
      } else {
        parent.children.push([newPersonInstance]);
      }
    } else if (childId) {
      const { person: child } = findPersonById(familyTree, childId);
      if (!child) {
        return res.status(404).json({ error: 'Không tìm thấy con với ID này' });
      }
      const { parent: childParent } = findParentById(familyTree, childId);
      if (childParent) {
        // Tìm ông/bà của child
        const { parent: grandParent, parentGroup: grandParentGroup } = findParentById(familyTree, childParent.id);
        if (grandParent) {
          // Thêm người mới vào children của ông/bà, đồng cấp với cha
          grandParent.children.push([newPersonInstance]);
        } else {
          // Nếu cha là root, thêm người mới đồng cấp với cha
          if (grandParentGroup) {
            grandParentGroup.push(newPersonInstance);
          } else {
            return res.status(500).json({ error: 'Không tìm thấy mảng chứa cha' });
          }
        }
      } else {
        // Nếu child là root, thêm người mới làm cha của tất cả node root
        const rootGroup = familyTree[0]; // Lấy mảng root
        if (!rootGroup || !rootGroup.includes(child)) {
          return res.status(404).json({ error: 'Node root không hợp lệ' });
        }
        newPersonInstance.children.push(rootGroup); // Thêm toàn bộ node root làm con
        familyTree.length = 0; // Xóa mảng root cũ
        familyTree.push([newPersonInstance]); // Thêm người mới làm root
        // Cập nhật level cho các con và hậu duệ
        assignLevels(newPersonInstance.children, newLevel + 1);
      }
    } else {
      return res.status(400).json({ error: 'Cần cung cấp parentId, siblingId hoặc childId' });
    }

    // Lưu dữ liệu với level
    await fs.writeFile(jsonFilePath, JSON.stringify(familyTree.map(group => group.map(p => p.toJSON())), null, 2), 'utf8');
    res.json({ message: 'Thêm người thành công', id: newPersonInstance.id });
  } catch (err) {
    res.status(500).json({ error: 'Không thể thêm người', details: err.message });
  }
});


// API sửa Persion theo id
app.put('/api/edit-person/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPerson = req.body;

    const data = await fs.readFile(jsonFilePath, 'utf8');
    let jsonData = JSON.parse(data);
    const familyTree = parseFamilyTree(jsonData);

    // Hàm tìm và cập nhật Person theo id
    function updatePersonById(persons) {
      for (let group of persons) {
        for (let person of group) {
          if (person.id === id) {
            person.name = updatedPerson.name || person.name;
            person.title = updatedPerson.title || person.title;
            person.gender = updatedPerson.gender || person.gender;
            person.outsider = updatedPerson.outsider === 'true' || updatedPerson.outsider === true ? true : person.outsider;
            person.isalive = updatedPerson.isalive === 'false' ? false : person.isalive;
            return true;
          }
          if (person.children && person.children.length > 0) {
            if (updatePersonById(person.children)) return true;
          }
        }
      }
      return false;
    }

    const updated = updatePersonById(familyTree);
    if (!updated) {
      return res.status(404).json({ error: 'Không tìm thấy người với ID này' });
    }

    await fs.writeFile(jsonFilePath, JSON.stringify(familyTree.map(group => group.map(p => p.toJSON())), null, 2), 'utf8');
    res.json({ message: 'Cập nhật người thành công', id });
  } catch (err) {
    res.status(500).json({ error: 'Không thể cập nhật người', details: err.message });
  }
});

// API xoá Person
app.delete('/api/delete-person/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Đọc và kiểm tra file JSON
    let jsonData;
    try {
      const data = await fs.readFile(jsonFilePath, 'utf8');
      jsonData = JSON.parse(data);
    } catch (parseErr) {
      console.error('Lỗi khi parse JSON ban đầu:', parseErr);
      return res.status(500).json({ error: 'File dữ liệu không hợp lệ', details: parseErr.message });
    }

    const familyTree = parseFamilyTree(jsonData);

    // Hàm tìm và xóa Person theo id, bao gồm toàn bộ nhánh con
    function deletePersonById(persons) {
      for (let i = persons.length - 1; i >= 0; i--) {
        const group = persons[i];
        for (let j = group.length - 1; j >= 0; j--) {
          if (group[j].id === id) {
            group.splice(j, 1); // Xóa person và toàn bộ nhánh của nó
            if (group.length === 0) {
              persons.splice(i, 1); // Nếu group rỗng, xóa group
            }
            return true;
          }
          if (group[j].children && group[j].children.length > 0) {
            if (deletePersonById(group[j].children)) {
              // Làm sạch children: Loại bỏ group rỗng
              group[j].children = group[j].children.filter(childGroup => childGroup.length > 0);
              return true;
            }
          }
        }
        // Xóa group rỗng
        if (group.length === 0) {
          persons.splice(i, 1);
        }
      }
      return false;
    }

    const deleted = deletePersonById(familyTree);
    if (!deleted) {
      return res.status(404).json({ error: 'Không tìm thấy người với ID này' });
    }

    // Làm sạch familyTree: Loại bỏ group rỗng ở cấp cao nhất
    const cleanedFamilyTree = familyTree.filter(group => group.length > 0);

    // Cập nhật lại level cho toàn bộ cây
    function assignLevels(groups, level) {
      for (let group of groups) {
        for (let person of group) {
          person.level = level;
          if (person.children && person.children.length > 0) {
            person.children = person.children.filter(childGroup => childGroup.length > 0);
            assignLevels(person.children, level + 1);
          }
        }
      }
    }
    assignLevels(cleanedFamilyTree, 0);

    // Debug: In dữ liệu trước khi ghi
    console.log('FamilyTree trước khi ghi:', JSON.stringify(cleanedFamilyTree, null, 2));

    // Tạo chuỗi JSON để ghi
    const jsonToWrite = cleanedFamilyTree.map(group => group.map(p => p.toJSON()));
    const jsonString = JSON.stringify(jsonToWrite, null, 2);
    console.log('JSON sẽ ghi vào file:', jsonString);

    // Xóa file cũ để đảm bảo ghi mới
    try {
      if (fss.existsSync(jsonFilePath)) {
        fss.unlinkSync(jsonFilePath);
        console.log('Đã xóa file data.json cũ');
      }
    } catch (unlinkErr) {
      console.error('Lỗi khi xóa file cũ:', unlinkErr);
    }

    // Ghi file đồng bộ
    try {
      fss.writeFileSync(jsonFilePath, jsonString, 'utf8');
      console.log('Đã ghi file data.json thành công');
    } catch (writeErr) {
      console.error('Lỗi khi ghi file:', writeErr);
      return res.status(500).json({ error: 'Không thể ghi file dữ liệu', details: writeErr.message });
    }

    // Kiểm tra file sau khi ghi
    let writtenData;
    try {
      writtenData = await fs.readFile(jsonFilePath, 'utf8');
      const writtenJson = JSON.parse(writtenData);
      console.log('Dữ liệu sau khi ghi:', JSON.stringify(writtenJson, null, 2));
    } catch (readErr) {
      console.error('Lỗi khi kiểm tra file sau khi ghi:', readErr);
      return res.status(500).json({ error: 'File dữ liệu không hợp lệ sau khi ghi', details: readErr.message });
    }

    res.json({ message: 'Xóa người thành công', id });
  } catch (err) {
    console.error('Lỗi khi xóa:', err);
    res.status(500).json({ error: 'Không thể xóa người', details: err.message });
  }
});

// Hàm đánh level cho dữ liệu có sẵn
function assignLevels(persons, level = 0) {
  if (!Array.isArray(persons)) return;
  persons.forEach(group => {
    group.forEach(person => {
      person.level = level;
      if (person.children && person.children.length > 0) {
        assignLevels(person.children, level + 1);
      }
    });
  });
}

function parseFamilyTree(data) {
  if (!Array.isArray(data) || data.length === 0) return [];
  const parsedTree = data.map(group => {
    if (!Array.isArray(group)) return [];
    return group.map(person => {
      return new Person(
        person.id,
        person.name,
        person.title,
        person.gender,
        person.outsider,
        person.isalive,
        person.children || [],
        person.level !== undefined ? person.level : 0
      );
    });
  });
  // Đánh level lại cho toàn bộ cây
  //assignLevels(parsedTree);
  fs.writeFile(jsonFilePath, JSON.stringify(parsedTree.map(group => group.map(p => p.toJSON())), null, 2), 'utf8');
  return parsedTree;
}

app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});
