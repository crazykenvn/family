const express = require('express');
const fs = require('fs').promises;
const fss = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/webfonts', express.static(path.join(__dirname, 'webfonts')));

class Person {
  constructor(id, name, title, gender, outsider, isalive = true, children = [], level = 0, birthdeath, thutu = 0) {
    this.id = id || '';
    this.name = name || 'Unknown';
    this.title = title || '';
    this.gender = gender || '';
    this.outsider = outsider === 'true' || outsider === true;
    this.isalive = isalive === 'false' ? false : true;
    this.children = this.parseChildren(children);
    this.level = level;
    this.birthdeath = birthdeath || '';
    this.thutu = thutu;
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
          child.level !== undefined ? child.level : childLevel,
          child.birthdeath,
          child.thutu
        );
      }).sort((a, b) => a.thutu - b.thutu);
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
      children: this.children.map(group => group.map(child => child.toJSON()).sort((a, b) => a.thutu - b.thutu)),
      level: this.level,
      birthdeath: this.birthdeath,
      thutu: this.thutu
    };
  }
}

const jsonFilePath = path.join(__dirname, 'data.json');

function findPersonById(data, id) {
  for (let group of data) {
    for (let person of group) {
      if (person.id === id) return { person, parentGroup: group, parent: null };
      for (let childGroup of person.children) {
        for (let child of childGroup) {
          if (child.id === id) return { person: child, parentGroup: childGroup, parent: person };
        }
        // Check nested children
        for (let subGroup of childGroup) {
          const found = findPersonById([childGroup], id);
          if (found.person) {
            found.parent = found.parent || person; // Ensure parent is set
            return found;
          }
        }
      }
    }
  }
  return { person: null, parent: null };
}

function findParentById(data, id) {
  for (let group of data) {
    for (let person of group) {
      for (let childGroup of person.children) {
        for (let child of childGroup) {
          if (child.id === id) {
            return { parent: person, parentGroup: group };
          }
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

function updateThutuForGroup(group) {
  group.forEach((person, index) => {
    person.thutu = index + 1;
  });
}

function updateThutu(familyTree) {
  function assignThutu(persons) {
    persons.forEach(group => {
      updateThutuForGroup(group);
      group.forEach(person => {
        if (person.children && person.children.length > 0) {
          assignThutu(person.children);
        }
      });
    });
  }
  assignThutu(familyTree);
}

app.get('/api/data', async (req, res) => {
  try {
    const data = await fs.readFile(jsonFilePath, 'utf8');
    const jsonData = JSON.parse(data);
    const familyTree = parseFamilyTree(jsonData);
    updateThutu(familyTree);
    res.json(familyTree.map(group => group.map(person => person.toJSON())));
  } catch (err) {
    res.status(500).json({ error: 'Không thể đọc file JSON', details: err.message });
  }
});

app.post('/api/add-person', async (req, res) => {
  try {
    const { newPerson, parentId, siblingId, childId } = req.body;

    const data = await fs.readFile(jsonFilePath, 'utf8');
    let jsonData = JSON.parse(data);
    const familyTree = parseFamilyTree(jsonData);

    let newLevel = 0;
    if (parentId) {
      const { person: parent } = findPersonById(familyTree, parentId);
      if (!parent) {
        return res.status(404).json({ error: 'Không tìm thấy cha/mẹ với ID này' });
      }
      newLevel = parent.level + 1;
    } else if (siblingId) {
      const { person: sibling, parent } = findPersonById(familyTree, siblingId);
      if (!sibling) {
        return res.status(404).json({ error: 'Không tìm thấy anh/chị/em với ID này' });
      }
      if (!parent && newPerson.outsider === 'true') {
        return res.status(404).json({ error: 'Không tìm thấy cha/mẹ của anh/chị/em để thêm người ngoài' });
      }
      newLevel = sibling.level;
    } else if (childId) {
      const { person: child } = findPersonById(familyTree, childId);
      if (!child) {
        return res.status(404).json({ error: 'Không tìm thấy con với ID này' });
      }
      newLevel = child.level > 0 ? child.level - 1 : 0;
    }

    const newid = generateNextId(familyTree);
    const newPersonInstance = new Person(
      newid,
      newPerson.name,
      newPerson.title,
      newPerson.gender,
      newPerson.outsider,
      newPerson.isalive,
      [],
      newLevel,
      newPerson.birthdeath,
      0
    );

    if (parentId) {
      const { person: parent } = findPersonById(familyTree, parentId);
      parent.children.push([newPersonInstance]);
    } else if (siblingId) {
      const { person: sibling, parent, parentGroup } = findPersonById(familyTree, siblingId);
      if (newPerson.outsider === 'true') {
        // Add to the same group as sibling (e.g., as a spouse)
        for (let group of parent.children) {
          if (group.includes(sibling)) {
            group.push(newPersonInstance);
            break;
          }
        }
      } else {
        // Add as a new child group under the same parent
        parent.children.push([newPersonInstance]);
      }
    } else if (childId) {
      const { person: child } = findPersonById(familyTree, childId);
      if (!child) {
        return res.status(404).json({ error: 'Không tìm thấy con với ID này' });
      }
      const { parent: childParent } = findParentById(familyTree, childId);
      if (childParent) {
        const { parent: grandParent, parentGroup: grandParentGroup } = findParentById(familyTree, childParent.id);
        if (grandParent) {
          grandParent.children.push([newPersonInstance]);
        } else {
          if (grandParentGroup) {
            grandParentGroup.push(newPersonInstance);
          } else {
            return res.status(500).json({ error: 'Không tìm thấy mảng chứa cha' });
          }
        }
      } else {
        const rootGroup = familyTree[0];
        if (!rootGroup || !rootGroup.includes(child)) {
          return res.status(404).json({ error: 'Node root không hợp lệ' });
        }
        newPersonInstance.children.push(rootGroup);
        familyTree.length = 0;
        familyTree.push([newPersonInstance]);
        assignLevels(newPersonInstance.children, newLevel + 1);
      }
    } else {
      return res.status(400).json({ error: 'Cần cung cấp parentId, siblingId hoặc childId' });
    }

    updateThutu(familyTree);

    await fs.writeFile(jsonFilePath, JSON.stringify(familyTree.map(group => group.map(p => p.toJSON())), null, 2), 'utf8');
    res.json({ message: 'Thêm người thành công', id: newPersonInstance.id });
  } catch (err) {
    res.status(500).json({ error: 'Không thể thêm người', details: err.message });
  }
});

app.put('/api/edit-person/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPerson = req.body;

    const data = await fs.readFile(jsonFilePath, 'utf8');
    let jsonData = JSON.parse(data);
    const familyTree = parseFamilyTree(jsonData);

    function updatePersonById(persons) {
      for (let group of persons) {
        for (let person of group) {
          if (person.id === id) {
            person.name = updatedPerson.name || person.name;
            person.title = updatedPerson.title || person.title;
            person.gender = updatedPerson.gender || person.gender;
            person.outsider = updatedPerson.outsider === 'true' || updatedPerson.outsider === true ? true : person.outsider;
            person.isalive = updatedPerson.isalive === 'false' ? false : person.isalive;
            person.birthdeath = updatedPerson.birthdeath || person.birthdeath;
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

    updateThutu(familyTree);

    await fs.writeFile(jsonFilePath, JSON.stringify(familyTree.map(group => group.map(p => p.toJSON())), null, 2), 'utf8');
    res.json({ message: 'Cập nhật người thành công', id });
  } catch (err) {
    res.status(500).json({ error: 'Không thể cập nhật người', details: err.message });
  }
});

app.delete('/api/delete-person/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let jsonData;
    try {
      const data = await fs.readFile(jsonFilePath, 'utf8');
      jsonData = JSON.parse(data);
    } catch (parseErr) {
      console.error('Lỗi khi parse JSON ban đầu:', parseErr);
      return res.status(500).json({ error: 'File dữ liệu không hợp lệ', details: parseErr.message });
    }

    const familyTree = parseFamilyTree(jsonData);

    function deletePersonById(persons) {
      for (let i = persons.length - 1; i >= 0; i--) {
        const group = persons[i];
        for (let j = group.length - 1; j >= 0; j--) {
          if (group[j].id === id) {
            group.splice(j, 1);
            if (group.length === 0) {
              persons.splice(i, 1);
            }
            return true;
          }
          if (group[j].children && group[j].children.length > 0) {
            if (deletePersonById(group[j].children)) {
              group[j].children = group[j].children.filter(childGroup => childGroup.length > 0);
              return true;
            }
          }
        }
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

    const cleanedFamilyTree = familyTree.filter(group => group.length > 0);

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

    updateThutu(cleanedFamilyTree);

    const jsonToWrite = cleanedFamilyTree.map(group => group.map(p => p.toJSON()));
    const jsonString = JSON.stringify(jsonToWrite, null, 2);

    try {
      if (fss.existsSync(jsonFilePath)) {
        fss.unlinkSync(jsonFilePath);
      }
    } catch (unlinkErr) {
      console.error('Lỗi khi xóa file cũ:', unlinkErr);
    }

    try {
      fss.writeFileSync(jsonFilePath, jsonString, 'utf8');
    } catch (writeErr) {
      console.error('Lỗi khi ghi file:', writeErr);
      return res.status(500).json({ error: 'Không thể ghi file dữ liệu', details: writeErr.message });
    }

    res.json({ message: 'Xóa người thành công', id });
  } catch (err) {
    console.error('Lỗi khi xóa:', err);
    res.status(500).json({ error: 'Không thể xóa người', details: err.message });
  }
});

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
        person.level !== undefined ? person.level : 0,
        person.birthdeath,
        person.thutu
      );
    });
  });
  updateThutu(parsedTree);
  return parsedTree;
}

app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});