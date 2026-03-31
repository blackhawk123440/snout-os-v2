/**
 * CSV field mapping configurations for each pet care platform.
 *
 * Each key maps to an array of possible CSV header names (case-insensitive matching).
 * The importer tries each name in order until it finds a match.
 */

export type Platform = 'time-to-pet' | 'gingr' | 'petexec' | 'generic';

export interface FieldMap {
  firstName: string[];
  lastName: string[];
  email: string[];
  phone: string[];
  address: string[];
  petName: string[];
  petSpecies: string[];
  petBreed: string[];
  petWeight: string[];
  petNotes: string[];
}

export const FIELD_MAPS: Record<Platform, FieldMap> = {
  'time-to-pet': {
    firstName: ['First Name', 'first_name', 'Client First Name'],
    lastName: ['Last Name', 'last_name', 'Client Last Name'],
    email: ['Email', 'email', 'Client Email'],
    phone: ['Phone', 'phone', 'Mobile', 'Cell Phone', 'Client Phone'],
    address: ['Address', 'address', 'Street Address', 'Full Address'],
    petName: ['Pet Name', 'pet_name', 'Pet'],
    petSpecies: ['Pet Type', 'species', 'Species', 'Type'],
    petBreed: ['Breed', 'breed', 'Pet Breed'],
    petWeight: ['Weight', 'weight', 'Pet Weight'],
    petNotes: ['Notes', 'notes', 'Pet Notes', 'Care Notes'],
  },
  'gingr': {
    firstName: ['owner_first_name', 'First Name', 'OwnerFirstName', 'Client First'],
    lastName: ['owner_last_name', 'Last Name', 'OwnerLastName', 'Client Last'],
    email: ['owner_email', 'Email', 'OwnerEmail'],
    phone: ['owner_phone', 'Phone', 'OwnerPhone', 'owner_cell'],
    address: ['owner_address', 'Address', 'OwnerAddress'],
    petName: ['pet_name', 'Name', 'PetName', 'Dog Name'],
    petSpecies: ['species', 'Pet Type', 'PetSpecies', 'Type'],
    petBreed: ['breed', 'PetBreed', 'Breed'],
    petWeight: ['weight', 'PetWeight', 'Weight'],
    petNotes: ['notes', 'PetNotes', 'Special Notes'],
  },
  'petexec': {
    firstName: ['ClientFirstName', 'First Name', 'OwnerFirst', 'client_first_name'],
    lastName: ['ClientLastName', 'Last Name', 'OwnerLast', 'client_last_name'],
    email: ['ClientEmail', 'Email', 'client_email'],
    phone: ['ClientPhone', 'ClientMobile', 'Phone', 'client_phone'],
    address: ['ClientAddress', 'Address', 'client_address'],
    petName: ['PetName', 'Pet Name', 'pet_name'],
    petSpecies: ['PetSpecies', 'Species', 'pet_species', 'PetType'],
    petBreed: ['PetBreed', 'Breed', 'pet_breed'],
    petWeight: ['PetWeight', 'Weight', 'pet_weight'],
    petNotes: ['PetNotes', 'Notes', 'pet_notes', 'SpecialInstructions'],
  },
  'generic': {
    firstName: ['First Name', 'first_name', 'firstname', 'first', 'fname', 'Given Name'],
    lastName: ['Last Name', 'last_name', 'lastname', 'last', 'lname', 'Family Name', 'Surname'],
    email: ['Email', 'email', 'Email Address', 'e-mail'],
    phone: ['Phone', 'phone', 'Mobile', 'Cell', 'Phone Number', 'Telephone'],
    address: ['Address', 'address', 'Street Address', 'Full Address', 'Home Address'],
    petName: ['Pet Name', 'pet_name', 'Pet', 'Animal Name', 'Name'],
    petSpecies: ['Species', 'Pet Type', 'Type', 'Animal Type', 'species'],
    petBreed: ['Breed', 'breed', 'Pet Breed'],
    petWeight: ['Weight', 'weight', 'Pet Weight'],
    petNotes: ['Notes', 'notes', 'Pet Notes', 'Care Notes', 'Special Instructions'],
  },
};

/**
 * Resolve a CSV header to a mapped field value.
 * Case-insensitive, trims whitespace.
 */
export function resolveField(
  row: Record<string, string>,
  possibleHeaders: string[]
): string | null {
  for (const header of possibleHeaders) {
    const lowerHeader = header.toLowerCase().trim();
    for (const [key, value] of Object.entries(row)) {
      if (key.toLowerCase().trim() === lowerHeader && value?.trim()) {
        return value.trim();
      }
    }
  }
  return null;
}

export interface MappedClientRow {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  petName: string | null;
  petSpecies: string | null;
  petBreed: string | null;
  petWeight: string | null;
  petNotes: string | null;
}

export function mapRow(row: Record<string, string>, platform: Platform): MappedClientRow {
  const map = FIELD_MAPS[platform];
  return {
    firstName: resolveField(row, map.firstName),
    lastName: resolveField(row, map.lastName),
    email: resolveField(row, map.email),
    phone: resolveField(row, map.phone),
    address: resolveField(row, map.address),
    petName: resolveField(row, map.petName),
    petSpecies: resolveField(row, map.petSpecies),
    petBreed: resolveField(row, map.petBreed),
    petWeight: resolveField(row, map.petWeight),
    petNotes: resolveField(row, map.petNotes),
  };
}
